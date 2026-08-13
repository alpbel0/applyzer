export type GitHubReference =
  | { type: "profile"; username: string }
  | { type: "repository"; username: string; repository: string };

const RESERVED_ROOTS = new Set([
  "about",
  "apps",
  "collections",
  "contact",
  "customer-stories",
  "enterprise",
  "events",
  "explore",
  "features",
  "issues",
  "login",
  "marketplace",
  "new",
  "notifications",
  "orgs",
  "pricing",
  "pulls",
  "search",
  "security",
  "settings",
  "signup",
  "sponsors",
  "topics",
  "trending",
]);

const NAME_PATTERN = /^[a-z\d](?:[a-z\d._-]*[a-z\d])?$/iu;

export function parseGitHubUrl(rawUrl: string): GitHubReference | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.hostname.replace(/^www\./u, "").toLowerCase() !== "github.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const username = segments[0];
  if (
    !username ||
    !NAME_PATTERN.test(username) ||
    RESERVED_ROOTS.has(username.toLowerCase())
  ) {
    return null;
  }

  const rawRepository = segments[1];
  if (!rawRepository) return { type: "profile", username };

  const repository = rawRepository.replace(/\.git$/iu, "");
  if (!repository || !NAME_PATTERN.test(repository)) return null;

  return { type: "repository", username, repository };
}
