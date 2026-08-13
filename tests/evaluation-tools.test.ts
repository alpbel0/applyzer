import { describe, expect, it, vi } from "vitest";

import {
  MAX_REPO_FILE_CHARACTERS,
  RepoFileTool,
  collectAllowedRepositories,
} from "@/lib/evaluation/tools";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

describe("RepoFileTool", () => {
  it("reads only allowlisted public repository text and truncates at 100k", async () => {
    const content = "a".repeat(MAX_REPO_FILE_CHARACTERS + 25);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ private: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          type: "file",
          encoding: "base64",
          content: Buffer.from(content).toString("base64"),
        }),
      );
    const tool = new RepoFileTool(
      ["ada/applyzer"],
      "token",
      fetcher as typeof fetch,
    );

    const result = await tool.execute({
      repo: "ada/applyzer",
      path: "src/index.ts",
    });

    expect(result).toMatchObject({ status: "ok", truncated: true });
    expect("content" in result && result.content).toHaveLength(
      MAX_REPO_FILE_CHARACTERS,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("blocks unlisted repos and traversal before making a request", async () => {
    const fetcher = vi.fn();
    const tool = new RepoFileTool(
      ["ada/applyzer"],
      "token",
      fetcher as typeof fetch,
    );

    expect(
      await tool.execute({ repo: "other/repo", path: "README.md" }),
    ).toMatchObject({ status: "forbidden" });
    expect(
      await tool.execute({ repo: "ada/applyzer", path: "../secret" }),
    ).toMatchObject({ status: "invalid_request" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a non-throwing limit result after fifteen calls", async () => {
    const tool = new RepoFileTool([], "token", vi.fn() as typeof fetch);
    for (let index = 1; index <= 15; index += 1) {
      await tool.execute({ repo: "other/repo", path: `file-${index}` });
    }

    expect(
      await tool.execute({ repo: "other/repo", path: "file-16" }),
    ).toMatchObject({ status: "limit_reached" });
    expect(tool.callCount).toBe(15);
  });
});

describe("collectAllowedRepositories", () => {
  it("extracts normalized detailed repository names", () => {
    expect(
      collectAllowedRepositories([
        {
          data: {
            repositories: [
              { full_name: "Ada/Applyzer" },
              { full_name: "ADA/SECOND" },
            ],
          },
        },
      ]),
    ).toEqual(new Set(["ada/applyzer", "ada/second"]));
  });
});
