import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import { summarizeUntrustedPage } from "@/lib/enrichment/summarize";
import type { EnrichmentHandlerOptions } from "@/lib/enrichment/types";
import { enrichmentResultSchema } from "@/lib/schemas/enrichment";

const MIN_ARTICLE_CHARACTERS = 500;
const MAX_HTML_CHARACTERS = 750_000;
const MAX_REDIRECTS = 3;

export type AddressResolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: AddressResolver = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [first, second, third] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase().replace(/^\[|\]$/gu, "");
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return false;
}

export async function assertPublicUrl(
  rawUrl: string,
  resolver: AddressResolver = defaultResolver,
) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported URL protocol.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("Private URL is not allowed.");
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error("Private URL is not allowed.");
  }
  if (!isIP(hostname)) {
    const addresses = await resolver(hostname);
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isPrivateAddress(address))
    ) {
      throw new Error("Private URL is not allowed.");
    }
  }
  return url;
}

async function fetchPublicHtml(
  rawUrl: string,
  options?: EnrichmentHandlerOptions & {
    resolver?: AddressResolver;
    timeoutMs?: number;
  },
) {
  let url = await assertPublicUrl(rawUrl, options?.resolver);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await (options?.fetcher ?? fetch)(url, {
      redirect: "manual",
      headers: {
        Accept: "text/html, application/xhtml+xml",
        "User-Agent": "Applyzer/1.0 (+candidate-link-enrichment)",
      },
      signal: options?.signal
        ? AbortSignal.any([
            options.signal,
            AbortSignal.timeout(options?.timeoutMs ?? 10_000),
          ])
        : AbortSignal.timeout(options?.timeoutMs ?? 10_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("Too many redirects.");
      }
      url = await assertPublicUrl(
        new URL(location, url).toString(),
        options?.resolver,
      );
      continue;
    }
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("html")) {
      throw new Error("Page is not HTML.");
    }
    return {
      finalUrl: url.toString(),
      html: (await response.text()).slice(0, MAX_HTML_CHARACTERS),
    };
  }
  throw new Error("Page redirect failed.");
}

export async function enrichGenericLink(
  url: string,
  options?: EnrichmentHandlerOptions & {
    resolver?: AddressResolver;
    summarize?: typeof summarizeUntrustedPage;
    source?: "generic" | "linkedin";
    timeoutMs?: number;
  },
) {
  const startedAt = Date.now();
  const source = options?.source ?? "generic";
  try {
    const page = await fetchPublicHtml(url, options);
    const dom = new JSDOM(page.html, { url: page.finalUrl });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.replace(/\s+/gu, " ").trim() ?? "";
    if (text.length < MIN_ARTICLE_CHARACTERS) {
      throw new Error("Page contains too little readable text.");
    }
    const summary = await (options?.summarize ?? summarizeUntrustedPage)(text, {
      signal: options?.signal,
    });
    return enrichmentResultSchema.parse({
      source,
      url,
      status: summary.fallback ? "partial" : "ok",
      data: {
        title: article?.title?.trim() || null,
        summary: summary.lines.join("\n"),
      },
      error: summary.fallback ? "LLM summary unavailable; fallback used" : null,
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error(`${source} enrichment failed`, { url, error });
    return enrichmentResultSchema.parse({
      source,
      url,
      status: "unreachable",
      data: null,
      error:
        source === "linkedin"
          ? "LinkedIn page could not be fetched"
          : "Web page could not be read",
      duration_ms: Date.now() - startedAt,
    });
  }
}
