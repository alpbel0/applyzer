import "server-only";

import { z } from "zod";

const GITHUB_API = "https://api.github.com";
export const MAX_REPO_FILE_CALLS = 15;
export const MAX_REPO_FILE_CHARACTERS = 100_000;

export const fetchRepoFileInputSchema = z
  .object({
    repo: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
        "Repo must use owner/name format.",
      ),
    path: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine(
        (value) =>
          !value.startsWith("/") &&
          !value.includes("\\") &&
          !value.split("/").includes(".."),
        "Path must be a safe repository-relative path.",
      ),
  })
  .strict();

export const fetchRepoFileToolDefinition = {
  type: "function" as const,
  function: {
    name: "fetch_repo_file",
    description:
      "Read one text file from a public GitHub repository already present in the candidate enrichment. Use only when it could change a rubric score.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        repo: {
          type: "string",
          description: "Repository in owner/name format.",
        },
        path: {
          type: "string",
          description: "Repository-relative text file path.",
        },
      },
      required: ["repo", "path"],
    },
  },
};

type GitHubContentResponse = {
  type?: string;
  encoding?: string;
  content?: string;
  size?: number;
};

function decodeContent(response: GitHubContentResponse) {
  if (
    response.type !== "file" ||
    response.encoding !== "base64" ||
    typeof response.content !== "string"
  ) {
    return null;
  }
  return Buffer.from(response.content.replace(/\s/gu, ""), "base64").toString(
    "utf8",
  );
}

export class RepoFileTool {
  private calls = 0;
  private readonly allowedRepositories: Set<string>;

  constructor(
    repositories: Iterable<string>,
    private readonly token = process.env.GITHUB_TOKEN,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.allowedRepositories = new Set(
      [...repositories].map((repository) => repository.toLowerCase()),
    );
  }

  get callCount() {
    return this.calls;
  }

  async execute(input: unknown) {
    if (this.calls >= MAX_REPO_FILE_CALLS) {
      return {
        status: "limit_reached" as const,
        error: `fetch_repo_file is limited to ${MAX_REPO_FILE_CALLS} calls. Continue with the evidence already available.`,
      };
    }
    this.calls += 1;

    const parsed = fetchRepoFileInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: "invalid_request" as const,
        error: parsed.error.issues[0]?.message ?? "Invalid tool input.",
      };
    }

    const normalizedRepo = parsed.data.repo.toLowerCase();
    if (!this.allowedRepositories.has(normalizedRepo)) {
      return {
        status: "forbidden" as const,
        error: "Repository is not present in the candidate enrichment.",
      };
    }
    if (!this.token) {
      return {
        status: "unreachable" as const,
        error: "GitHub access is not configured.",
      };
    }

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "User-Agent": "Applyzer",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    try {
      const repositoryResponse = await this.fetcher(
        `${GITHUB_API}/repos/${parsed.data.repo}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!repositoryResponse.ok) {
        return {
          status: "unreachable" as const,
          error: `GitHub repository returned ${repositoryResponse.status}.`,
        };
      }
      const repository = (await repositoryResponse.json()) as {
        private?: boolean;
      };
      if (repository.private !== false) {
        return {
          status: "forbidden" as const,
          error: "Only confirmed public repositories can be read.",
        };
      }

      const contentResponse = await this.fetcher(
        `${GITHUB_API}/repos/${parsed.data.repo}/contents/${parsed.data.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!contentResponse.ok) {
        return {
          status: "unreachable" as const,
          error: `GitHub file returned ${contentResponse.status}.`,
        };
      }

      const content = decodeContent(
        (await contentResponse.json()) as GitHubContentResponse,
      );
      if (content === null || content.includes("\0")) {
        return {
          status: "unsupported" as const,
          error: "The requested path is not a readable text file.",
        };
      }
      const truncated = content.length > MAX_REPO_FILE_CHARACTERS;
      return {
        status: "ok" as const,
        repo: parsed.data.repo,
        path: parsed.data.path,
        content: content.slice(0, MAX_REPO_FILE_CHARACTERS),
        truncated,
      };
    } catch {
      return {
        status: "unreachable" as const,
        error: "GitHub file could not be fetched.",
      };
    }
  }
}

export function collectAllowedRepositories(enrichment: unknown[]) {
  const repositories = new Set<string>();
  for (const row of enrichment) {
    if (row === null || typeof row !== "object") continue;
    const data = (row as { data?: unknown }).data;
    if (data === null || typeof data !== "object") continue;
    const detailed = (data as { repositories?: unknown }).repositories;
    if (!Array.isArray(detailed)) continue;
    for (const repository of detailed) {
      if (
        repository !== null &&
        typeof repository === "object" &&
        typeof (repository as { full_name?: unknown }).full_name === "string"
      ) {
        repositories.add(
          (repository as { full_name: string }).full_name.toLowerCase(),
        );
      }
    }
  }
  return repositories;
}
