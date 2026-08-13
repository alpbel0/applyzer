import "server-only";

import {
  extractRepositoryFlags,
  summarizeReadme,
} from "@/lib/enrichment/flags";
import {
  parseGitHubUrl,
  type GitHubReference,
} from "@/lib/enrichment/github-url";

const GITHUB_API = "https://api.github.com";
const MAX_REQUESTS = 32;
const MAX_DETAILED_REPOSITORIES = 10;

type EnrichmentStatus = "ok" | "partial" | "unreachable" | "skipped";

export type GitHubEnrichmentResult = {
  url: string;
  status: EnrichmentStatus;
  data: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number;
};

type GitHubUser = {
  login: string;
  created_at: string;
  public_repos: number;
  followers: number;
};

type GitHubRepository = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  language: string | null;
  size: number;
  default_branch: string;
  created_at: string;
  pushed_at: string | null;
  license: { spdx_id: string | null } | null;
};

type DetailedRepository = {
  name: string;
  full_name: string;
  url: string;
  description: string | null;
  primary_language: string | null;
  size_kb: number;
  last_push: string | null;
  license: string | null;
  default_branch: string;
  empty: boolean;
  readme_summary: string | null;
  flags: string[];
  languages: Record<string, number>;
  detail_status: "ok" | "partial";
};

class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimited: boolean,
  ) {
    super(message);
  }
}

class GitHubClient {
  requests = 0;

  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch,
  ) {}

  async get<T>(path: string): Promise<T>;
  async get<T>(
    path: string,
    options: { accept?: string; allow404: true },
  ): Promise<T | null>;
  async get<T>(
    path: string,
    options?: { accept?: string; allow404?: boolean },
  ): Promise<T | null> {
    if (this.requests >= MAX_REQUESTS) {
      throw new GitHubApiError("GitHub request budget exhausted", 429, true);
    }
    this.requests += 1;

    const response = await this.fetcher(`${GITHUB_API}${path}`, {
      headers: {
        Accept: options?.accept ?? "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "Applyzer",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404 && options?.allow404) return null;
    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const rateLimited =
        response.status === 429 ||
        (response.status === 403 && remaining === "0");
      throw new GitHubApiError(
        rateLimited
          ? "GitHub rate limit reached"
          : `GitHub returned ${response.status}`,
        response.status,
        rateLimited,
      );
    }

    return (await response.json()) as T;
  }
}

function monthsSince(isoDate: string) {
  const created = new Date(isoDate);
  const now = new Date();
  return Math.max(
    0,
    (now.getUTCFullYear() - created.getUTCFullYear()) * 12 +
      now.getUTCMonth() -
      created.getUTCMonth(),
  );
}

function normalizedLanguageShares(languages: Record<string, number>) {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  if (total === 0) return {};
  return Object.fromEntries(
    Object.entries(languages)
      .sort(([, left], [, right]) => right - left)
      .map(([language, bytes]) => [
        language,
        Number((bytes / total).toFixed(4)),
      ]),
  );
}

function decodeBase64(value: string) {
  return Buffer.from(value.replace(/\s/gu, ""), "base64").toString("utf8");
}

async function inspectRepository(
  client: GitHubClient,
  repository: GitHubRepository,
): Promise<DetailedRepository> {
  const [languagesResult, readmeResult, treeResult] = await Promise.allSettled([
    client.get<Record<string, number>>(
      `/repos/${repository.full_name}/languages`,
    ),
    client.get<{ content: string; size: number }>(
      `/repos/${repository.full_name}/readme?ref=${encodeURIComponent(repository.default_branch)}`,
      { allow404: true },
    ),
    client.get<{ tree: Array<{ path?: string }>; truncated: boolean }>(
      `/repos/${repository.full_name}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`,
      { allow404: true },
    ),
  ]);

  const languages =
    languagesResult.status === "fulfilled" ? languagesResult.value : {};
  const readme =
    readmeResult.status === "fulfilled" && readmeResult.value
      ? decodeBase64(readmeResult.value.content)
      : null;
  const readmeSize =
    readmeResult.status === "fulfilled" && readmeResult.value
      ? readmeResult.value.size
      : null;
  const paths =
    treeResult.status === "fulfilled" && treeResult.value
      ? treeResult.value.tree.flatMap((entry) =>
          entry.path ? [entry.path] : [],
        )
      : [];
  const partial = [languagesResult, readmeResult, treeResult].some(
    (result) => result.status === "rejected",
  );

  return {
    name: repository.name,
    full_name: repository.full_name,
    url: repository.html_url,
    description: repository.description,
    primary_language: repository.language,
    size_kb: repository.size,
    last_push: repository.pushed_at,
    license: repository.license?.spdx_id ?? null,
    default_branch: repository.default_branch,
    empty:
      repository.size === 0 || repository.created_at === repository.pushed_at,
    readme_summary: summarizeReadme(readme),
    flags: extractRepositoryFlags({ paths, readme, readmeSize }),
    languages: normalizedLanguageShares(languages),
    detail_status: partial ? "partial" : "ok",
  };
}

function repositoryKey(username: string, repository: string) {
  return `${username}/${repository}`.toLowerCase();
}

async function enrichOwnerGroup(
  client: GitHubClient,
  username: string,
  references: Array<{ url: string; reference: GitHubReference }>,
) {
  const hasProfile = references.some(
    ({ reference }) => reference.type === "profile",
  );
  const explicitRepositoryNames = references.flatMap(({ reference }) =>
    reference.type === "repository" ? [reference.repository] : [],
  );
  const explicitRepositories = new Map<string, GitHubRepository>();
  let user: GitHubUser | null = null;
  let repositories: GitHubRepository[] = [];

  if (hasProfile) {
    [user, repositories] = await Promise.all([
      client.get<GitHubUser>(`/users/${encodeURIComponent(username)}`),
      client.get<GitHubRepository[]>(
        `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed&type=owner`,
      ),
    ]);
    repositories = repositories.filter((repository) => !repository.fork);
  }

  for (const name of explicitRepositoryNames) {
    const fromProfile = repositories.find(
      (repository) => repository.name.toLowerCase() === name.toLowerCase(),
    );
    if (fromProfile) {
      explicitRepositories.set(repositoryKey(username, name), fromProfile);
      continue;
    }
    if (client.requests + 4 > MAX_REQUESTS) break;
    const repository = await client.get<GitHubRepository>(
      `/repos/${encodeURIComponent(username)}/${encodeURIComponent(name)}`,
    );
    if (!repository.fork) {
      explicitRepositories.set(repositoryKey(username, name), repository);
    }
  }

  const selected = new Map<string, GitHubRepository>();
  for (const repository of explicitRepositories.values()) {
    selected.set(repository.full_name.toLowerCase(), repository);
  }
  for (const repository of repositories) {
    if (selected.size >= MAX_DETAILED_REPOSITORIES) break;
    selected.set(repository.full_name.toLowerCase(), repository);
  }

  const detailCapacity = Math.min(
    MAX_DETAILED_REPOSITORIES,
    Math.floor((MAX_REQUESTS - client.requests) / 3),
  );
  const detailedRepositories: DetailedRepository[] = [];
  for (const repository of [...selected.values()].slice(0, detailCapacity)) {
    detailedRepositories.push(await inspectRepository(client, repository));
  }

  const aggregateLanguages: Record<string, number> = {};
  for (const repository of detailedRepositories) {
    for (const [language, share] of Object.entries(repository.languages)) {
      aggregateLanguages[language] =
        (aggregateLanguages[language] ?? 0) + share;
    }
  }

  const ownerData = {
    username,
    account_age_months: user ? monthsSince(user.created_at) : null,
    public_repositories: user?.public_repos ?? null,
    non_fork_repositories: hasProfile ? repositories.length : null,
    followers: user?.followers ?? null,
    last_activity:
      detailedRepositories
        .map((repository) => repository.last_push)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
    languages: normalizedLanguageShares(aggregateLanguages),
    repositories: detailedRepositories,
    repository_metadata: repositories.map((repository) => ({
      name: repository.name,
      url: repository.html_url,
      description: repository.description,
      primary_language: repository.language,
      size_kb: repository.size,
      last_push: repository.pushed_at,
      license: repository.license?.spdx_id ?? null,
      empty:
        repository.size === 0 || repository.created_at === repository.pushed_at,
    })),
    github_requests: client.requests,
  };

  return references.map(({ url, reference }) => {
    if (reference.type === "profile") return { url, data: ownerData };
    const key = repositoryKey(reference.username, reference.repository);
    const repository = detailedRepositories.find(
      (item) => item.full_name.toLowerCase() === key,
    );
    return {
      url,
      data: { ...ownerData, requested_repository: repository ?? null },
    };
  });
}

function publicError(error: unknown) {
  if (error instanceof GitHubApiError) {
    if (error.rateLimited) return "GitHub rate limit reached";
    if (error.status === 404) return "GitHub resource not found";
    if (error.status === 401) return "GitHub authentication failed";
  }
  return "GitHub resource could not be fetched";
}

export async function enrichGitHubLinks(
  links: string[],
  options?: { token?: string; fetcher?: typeof fetch },
): Promise<GitHubEnrichmentResult[]> {
  const startedAt = Date.now();
  const parsed = links.flatMap((url) => {
    const reference = parseGitHubUrl(url);
    return reference ? [{ url, reference }] : [];
  });
  if (parsed.length === 0) return [];

  const token = options?.token ?? process.env.GITHUB_TOKEN;
  if (!token) {
    return parsed.map(({ url }) => ({
      url,
      status: "unreachable",
      data: null,
      error: "GitHub token is not configured",
      duration_ms: Date.now() - startedAt,
    }));
  }

  const groups = new Map<string, typeof parsed>();
  for (const item of parsed) {
    const key = item.reference.username.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const results: GitHubEnrichmentResult[] = [];
  const client = new GitHubClient(token, options?.fetcher ?? fetch);

  for (const [username, references] of groups) {
    const groupStartedAt = Date.now();
    try {
      const enriched = await enrichOwnerGroup(client, username, references);
      for (const result of enriched) {
        const repositories = result.data.repositories as DetailedRepository[];
        results.push({
          url: result.url,
          status: repositories.some(
            (repository) => repository.detail_status === "partial",
          )
            ? "partial"
            : "ok",
          data: result.data,
          error: null,
          duration_ms: Date.now() - groupStartedAt,
        });
      }
    } catch (error) {
      console.error("GitHub enrichment failed", { username, error });
      for (const { url } of references) {
        results.push({
          url,
          status: "unreachable",
          data: null,
          error: publicError(error),
          duration_ms: Date.now() - groupStartedAt,
        });
      }
    }
  }

  return results;
}
