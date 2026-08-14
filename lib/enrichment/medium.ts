import "server-only";

import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";

import { summarizeUntrustedPage } from "@/lib/enrichment/summarize";
import type { EnrichmentHandlerOptions } from "@/lib/enrichment/types";
import { enrichmentResultSchema } from "@/lib/schemas/enrichment";

const MAX_ITEMS = 8;

type FeedItem = {
  title?: unknown;
  pubDate?: unknown;
  encoded?: unknown;
  description?: unknown;
};

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) {
    return textValue((value as { "#text": unknown })["#text"]);
  }
  return "";
}

function htmlToText(html: string) {
  return (
    new JSDOM(`<body>${html}</body>`).window.document.body.textContent
      ?.replace(/\s+/gu, " ")
      .trim() ?? ""
  );
}

export function mediumFeedUrl(rawUrl: string, allowCustomDomain = false) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.replace(/^www\./u, "").toLowerCase();
    if (hostname === "medium.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (!parts[0]) return null;
      const profileOrPublication = parts[0];
      return `https://medium.com/feed/${profileOrPublication}`;
    }
    if (hostname.endsWith(".medium.com")) {
      return `${url.protocol}//${url.host}/feed`;
    }
    if (allowCustomDomain) return `${url.origin}/feed`;
    return null;
  } catch {
    return null;
  }
}

export function parseMediumFeed(xml: string) {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
  }).parse(xml) as {
    rss?: { channel?: { item?: FeedItem | FeedItem[] } };
  };
  const rawItems = parsed.rss?.channel?.item;
  const items = (
    Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []
  )
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      title: textValue(item.title),
      publishedAt: textValue(item.pubDate),
      content: htmlToText(
        textValue(item.encoded) || textValue(item.description),
      ),
    }))
    .filter((item) => item.title);
  if (items.length === 0) throw new Error("RSS feed contains no items.");
  return items;
}

export async function enrichMediumLink(
  url: string,
  options?: EnrichmentHandlerOptions & {
    allowCustomDomain?: boolean;
    summarize?: typeof summarizeUntrustedPage;
    silent?: boolean;
  },
) {
  const startedAt = Date.now();
  const feedUrl = mediumFeedUrl(url, options?.allowCustomDomain);
  if (!feedUrl) {
    return enrichmentResultSchema.parse({
      source: "medium",
      url,
      status: "unreachable",
      data: null,
      error: "Invalid Medium URL",
      duration_ms: Date.now() - startedAt,
    });
  }

  try {
    const response = await (options?.fetcher ?? fetch)(feedUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9",
        "User-Agent": "Applyzer/1.0",
      },
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
      redirect: options?.allowCustomDomain ? "manual" : "follow",
    });
    if (
      options?.allowCustomDomain &&
      [301, 302, 303, 307, 308].includes(response.status)
    ) {
      throw new Error("Custom feed redirected.");
    }
    if (!response.ok) throw new Error(`RSS returned ${response.status}`);
    const items = parseMediumFeed(await response.text());
    const dates = items.flatMap((item) => {
      const date = new Date(item.publishedAt);
      return Number.isNaN(date.valueOf()) ? [] : [date];
    });
    const combined = items
      .map(
        (item) =>
          `Başlık: ${item.title}\nİçerik: ${item.content.slice(0, 4_000)}`,
      )
      .join("\n\n");
    const summary = await (options?.summarize ?? summarizeUntrustedPage)(
      combined,
      { signal: options?.signal },
    );

    return enrichmentResultSchema.parse({
      source: "medium",
      url,
      status: summary.fallback ? "partial" : "ok",
      data: {
        titles: items.map((item) => item.title),
        last_activity:
          dates
            .sort((left, right) => right.valueOf() - left.valueOf())[0]
            ?.toISOString()
            .slice(0, 10) ?? null,
        summaries: summary.lines,
      },
      error: summary.fallback ? "LLM summary unavailable; fallback used" : null,
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    if (!options?.silent) {
      console.error("Medium enrichment failed", { url, error });
    }
    return enrichmentResultSchema.parse({
      source: "medium",
      url,
      status: "unreachable",
      data: null,
      error: "Medium feed could not be fetched",
      duration_ms: Date.now() - startedAt,
    });
  }
}
