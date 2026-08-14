import { beforeEach, describe, expect, it, vi } from "vitest";

const unreachable = (source: string, url: string) => ({
  source,
  url,
  status: "unreachable" as const,
  data: null,
  error: `${source} unavailable`,
  duration_ms: 1,
});

const enrichGitHubLinks = vi.fn();
const enrichKaggleLink = vi.fn();
const enrichMediumLink = vi.fn();
const enrichGenericLink = vi.fn();

vi.mock("@/lib/enrichment/github", () => ({
  enrichGitHubLinks,
  parseGitHubUrl: vi.fn(),
}));
vi.mock("@/lib/enrichment/kaggle", () => ({ enrichKaggleLink }));
vi.mock("@/lib/enrichment/medium", () => ({ enrichMediumLink }));
vi.mock("@/lib/enrichment/generic", () => ({
  assertPublicUrl: vi.fn(async (url: string) => new URL(url)),
  enrichGenericLink,
}));

describe("enrichment pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enrichGitHubLinks.mockResolvedValue([
      {
        url: "https://github.com/demo",
        status: "unreachable",
        data: null,
        error: "GitHub unavailable",
        duration_ms: 1,
      },
    ]);
    enrichKaggleLink.mockImplementation(async (url: string) =>
      unreachable("kaggle", url),
    );
    enrichMediumLink.mockImplementation(async (url: string) =>
      unreachable("medium", url),
    );
    enrichGenericLink.mockImplementation(
      async (url: string, options?: { source?: string }) =>
        unreachable(options?.source ?? "generic", url),
    );
  });

  it("returns isolated unreachable records instead of blocking evaluation", async () => {
    const { enrichLinks } = await import("@/lib/enrichment");
    const results = await enrichLinks([
      { source: "github", url: "https://github.com/demo" },
      { source: "kaggle", url: "https://kaggle.com/demo" },
      { source: "medium", url: "https://medium.com/@demo" },
      { source: "generic", url: "https://portfolio.example.com" },
      { source: "linkedin", url: "https://linkedin.com/in/demo" },
    ]);

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.status === "unreachable")).toBe(
      true,
    );
  });
});
