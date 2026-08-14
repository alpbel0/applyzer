import type { EnrichmentResult } from "@/lib/schemas/enrichment";

export type StoredEnrichmentResult = EnrichmentResult;

export type EnrichmentHandlerOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};
