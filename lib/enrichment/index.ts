import type { ExtractedLink } from "@/lib/cv/extract-links";
import { assertPublicUrl, enrichGenericLink } from "@/lib/enrichment/generic";
import { enrichGitHubLinks } from "@/lib/enrichment/github";
import { enrichKaggleLink } from "@/lib/enrichment/kaggle";
import { enrichMediumLink } from "@/lib/enrichment/medium";
import { enrichmentResultSchema } from "@/lib/schemas/enrichment";

export { classifyLink } from "@/lib/cv/extract-links";
export type { ExtractedLink, LinkSource } from "@/lib/cv/extract-links";
export { enrichGitHubLinks } from "@/lib/enrichment/github";
export { parseGitHubUrl } from "@/lib/enrichment/github-url";

const ENRICHMENT_DEADLINE_MS = 38_000;
const MAX_NON_GITHUB_LINKS = 20;

function skippedResult(link: ExtractedLink) {
  return enrichmentResultSchema.parse({
    source: link.source,
    url: link.url,
    status: "skipped",
    data: null,
    error: "Non-GitHub enrichment link limit exceeded",
    duration_ms: 0,
  });
}

async function enrichNonGitHubLink(link: ExtractedLink, signal: AbortSignal) {
  if (link.source === "kaggle") {
    return enrichKaggleLink(link.url, { signal });
  }
  if (link.source === "medium") {
    return enrichMediumLink(link.url, { signal });
  }
  if (link.source === "linkedin") {
    return enrichGenericLink(link.url, {
      signal,
      source: "linkedin",
      timeoutMs: 5_000,
    });
  }

  try {
    await assertPublicUrl(link.url);
  } catch {
    return enrichGenericLink(link.url, { signal });
  }
  const feedResult = await enrichMediumLink(link.url, {
    signal,
    allowCustomDomain: true,
    silent: true,
  });
  if (feedResult.status !== "unreachable") return feedResult;
  return enrichGenericLink(link.url, { signal });
}

export async function enrichLinks(links: ExtractedLink[]) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), ENRICHMENT_DEADLINE_MS);
  try {
    const githubUrls = links
      .filter((link) => link.source === "github")
      .map((link) => link.url);
    const nonGitHub = links.filter((link) => link.source !== "github");
    const selected = nonGitHub.slice(0, MAX_NON_GITHUB_LINKS);
    const skipped = nonGitHub.slice(MAX_NON_GITHUB_LINKS).map(skippedResult);

    const [githubResults, otherResults] = await Promise.all([
      enrichGitHubLinks(githubUrls, { signal: controller.signal }),
      Promise.all(
        selected.map((link) => enrichNonGitHubLink(link, controller.signal)),
      ),
    ]);

    return [
      ...githubResults.map((result) =>
        enrichmentResultSchema.parse({ source: "github", ...result }),
      ),
      ...otherResults,
      ...skipped,
    ];
  } finally {
    clearTimeout(deadline);
  }
}
