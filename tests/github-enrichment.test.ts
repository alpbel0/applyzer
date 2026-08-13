import { describe, expect, it } from "vitest";

import { enrichGitHubLinks } from "@/lib/enrichment/github";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GitHub enrichment", () => {
  it("prioritizes explicit repos, inspects six repos and stays within 20 requests", async () => {
    const requested: string[] = [];
    const repositories = Array.from({ length: 7 }, (_, index) => ({
      name: index === 6 ? "MentorMind" : `repo-${index}`,
      full_name: index === 6 ? "alpbel0/MentorMind" : `alpbel0/repo-${index}`,
      html_url:
        index === 6
          ? "https://github.com/alpbel0/MentorMind"
          : `https://github.com/alpbel0/repo-${index}`,
      description: null,
      fork: false,
      language: "TypeScript",
      size: index === 0 ? 0 : 100,
      default_branch: "develop",
      created_at: "2024-01-01T00:00:00Z",
      pushed_at: `2026-08-0${7 - index}T00:00:00Z`,
      license: { spdx_id: "MIT" },
    }));
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input);
      requested.push(url);
      if (url.endsWith("/users/alpbel0"))
        return jsonResponse({
          login: "alpbel0",
          created_at: "2024-01-01T00:00:00Z",
          public_repos: 7,
          followers: 3,
        });
      if (url.includes("/users/alpbel0/repos?"))
        return jsonResponse(repositories);
      if (url.endsWith("/languages"))
        return jsonResponse({ TypeScript: 75, SQL: 25 });
      if (url.includes("/readme?"))
        return jsonResponse({
          content: Buffer.from("OpenAI LangGraph ".repeat(100)).toString(
            "base64",
          ),
          size: 1600,
        });
      if (url.includes("/git/trees/"))
        return jsonResponse({
          tree: [
            { path: ".github/workflows/test.yml" },
            { path: "Dockerfile" },
            { path: "tests/app.spec.ts" },
          ],
          truncated: false,
        });
      return jsonResponse({ message: "not found" }, 404);
    };

    const results = await enrichGitHubLinks(
      ["https://github.com/alpbel0", "https://github.com/alpbel0/MentorMind"],
      { token: "test-token", fetcher: fetcher as typeof fetch },
    );

    expect(requested).toHaveLength(20);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === "ok")).toBe(true);
    const profileData = results[0]?.data as {
      github_requests: number;
      repository_metadata: Array<{ name: string; empty: boolean }>;
      repositories: Array<{ name: string; flags: string[] }>;
    };
    expect(profileData.github_requests).toBe(20);
    expect(profileData.repositories).toHaveLength(6);
    expect(profileData.repositories[0]?.name).toBe("MentorMind");
    expect(profileData.repositories[0]?.flags).toEqual(
      expect.arrayContaining([
        "tests",
        "ci",
        "docker",
        "llm_sdk",
        "agent_framework",
      ]),
    );
    expect(profileData.repository_metadata).toContainEqual(
      expect.objectContaining({ name: "repo-0", empty: true }),
    );
  });

  it("records a missing user as unreachable", async () => {
    const results = await enrichGitHubLinks(
      ["https://github.com/does-not-exist"],
      {
        token: "test-token",
        fetcher: (async () =>
          jsonResponse({ message: "Not Found" }, 404)) as typeof fetch,
      },
    );

    expect(results).toEqual([
      expect.objectContaining({
        status: "unreachable",
        error: "GitHub resource not found",
      }),
    ]);
  });
});
