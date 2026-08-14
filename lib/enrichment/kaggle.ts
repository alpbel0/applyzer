import "server-only";

import { enrichmentResultSchema } from "@/lib/schemas/enrichment";
import type { EnrichmentHandlerOptions } from "@/lib/enrichment/types";

const KAGGLE_API = "https://www.kaggle.com/api/v1/kernels/list";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_TITLES = 30;

type KaggleKernel = {
  title?: unknown;
  totalVotes?: unknown;
  lastRunTime?: unknown;
};

export function parseKaggleUsername(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.replace(/^www\./u, "").toLowerCase();
    if (hostname !== "kaggle.com") return null;
    const username = url.pathname.split("/").filter(Boolean)[0];
    if (!username || !/^[a-z\d_-]{1,40}$/iu.test(username)) return null;
    if (["code", "competitions", "datasets", "models"].includes(username)) {
      return null;
    }
    return username;
  } catch {
    return null;
  }
}

export function kaggleAuthorization(token: string) {
  try {
    const parsed = JSON.parse(token) as { username?: unknown; key?: unknown };
    if (typeof parsed.username === "string" && typeof parsed.key === "string") {
      return `Basic ${Buffer.from(`${parsed.username}:${parsed.key}`).toString("base64")}`;
    }
  } catch {
    // Modern Kaggle tokens are opaque bearer strings, not JSON.
  }
  return `Bearer ${token}`;
}

function publicError(status: number | null) {
  if (status === 401 || status === 403) return "Kaggle authentication failed";
  if (status === 404) return "Kaggle profile not found";
  if (status === 429) return "Kaggle rate limit reached";
  return "Kaggle profile could not be fetched";
}

export async function enrichKaggleLink(
  url: string,
  options?: EnrichmentHandlerOptions & { token?: string },
) {
  const startedAt = Date.now();
  const username = parseKaggleUsername(url);
  if (!username) {
    return enrichmentResultSchema.parse({
      source: "kaggle",
      url,
      status: "unreachable",
      data: null,
      error: "Invalid Kaggle profile URL",
      duration_ms: Date.now() - startedAt,
    });
  }
  const token = options?.token ?? process.env.KAGGLE_API_TOKEN?.trim();
  if (!token) {
    return enrichmentResultSchema.parse({
      source: "kaggle",
      url,
      status: "unreachable",
      data: null,
      error: "Kaggle token is not configured",
      duration_ms: Date.now() - startedAt,
    });
  }

  const kernels: KaggleKernel[] = [];
  let responseStatus: number | null = null;
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const endpoint = new URL(KAGGLE_API);
      endpoint.searchParams.set("user", username);
      endpoint.searchParams.set("page", String(page));
      endpoint.searchParams.set("pageSize", String(PAGE_SIZE));
      endpoint.searchParams.set("sortBy", "dateRun");
      const response = await (options?.fetcher ?? fetch)(endpoint, {
        headers: {
          Accept: "application/json",
          Authorization: kaggleAuthorization(token),
          "User-Agent": "Applyzer",
        },
        signal: options?.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
          : AbortSignal.timeout(10_000),
      });
      responseStatus = response.status;
      if (!response.ok) throw new Error(`Kaggle returned ${response.status}`);
      const pageItems = (await response.json()) as unknown;
      if (!Array.isArray(pageItems)) throw new Error("Invalid Kaggle response");
      kernels.push(...(pageItems as KaggleKernel[]));
      if (pageItems.length < PAGE_SIZE) break;
    }

    const titles = kernels.flatMap((kernel) =>
      typeof kernel.title === "string" && kernel.title.trim()
        ? [kernel.title.trim()]
        : [],
    );
    const dates = kernels.flatMap((kernel) => {
      if (typeof kernel.lastRunTime !== "string") return [];
      const date = new Date(kernel.lastRunTime);
      return Number.isNaN(date.valueOf()) ? [] : [date];
    });
    const lastActivity = dates.sort(
      (left, right) => right.valueOf() - left.valueOf(),
    )[0];

    return enrichmentResultSchema.parse({
      source: "kaggle",
      url,
      status: "ok",
      data: {
        notebook_count: kernels.length,
        total_votes: kernels.reduce(
          (sum, kernel) =>
            sum +
            (typeof kernel.totalVotes === "number" && kernel.totalVotes > 0
              ? kernel.totalVotes
              : 0),
          0,
        ),
        last_activity: lastActivity?.toISOString().slice(0, 10) ?? null,
        titles: titles.slice(0, MAX_TITLES),
      },
      error: null,
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Kaggle enrichment failed", { username, error });
    return enrichmentResultSchema.parse({
      source: "kaggle",
      url,
      status: "unreachable",
      data: null,
      error: publicError(responseStatus),
      duration_ms: Date.now() - startedAt,
    });
  }
}
