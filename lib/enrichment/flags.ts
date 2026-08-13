export const REPOSITORY_FLAGS = [
  "tests",
  "ci",
  "docker",
  "mcp",
  "llm_sdk",
  "agent_framework",
  "prompt_management",
  "ai_tool",
  "db",
  "documentation",
] as const;

export type RepositoryFlag = (typeof REPOSITORY_FLAGS)[number];

type FlagInput = {
  paths: string[];
  readme: string | null;
  readmeSize: number | null;
};

export function extractRepositoryFlags(input: FlagInput): RepositoryFlag[] {
  const paths = input.paths.map((path) => path.toLowerCase());
  const searchable = `${paths.join("\n")}\n${input.readme ?? ""}`.toLowerCase();
  const hasPath = (pattern: RegExp) => paths.some((path) => pattern.test(path));
  const flags = new Set<RepositoryFlag>();

  if (
    hasPath(/(^|\/)tests?\//u) ||
    hasPath(/(^|\/)test_[^/]*\.py$/u) ||
    hasPath(/(^|\/)pytest\.ini$/u) ||
    hasPath(/\.(?:spec|test)\.[cm]?[jt]sx?$/u)
  )
    flags.add("tests");
  if (hasPath(/^\.github\/workflows\//u)) flags.add("ci");
  if (
    hasPath(/(^|\/)dockerfile(?:\.[^/]*)?$/u) ||
    hasPath(/(^|\/)docker-compose(?:\.[^/]*)?\.ya?ml$/u) ||
    hasPath(/(^|\/)compose\.ya?ml$/u)
  )
    flags.add("docker");
  if (/\bmcp\b|@modelcontextprotocol/u.test(searchable)) flags.add("mcp");
  if (/\b(?:openai|anthropic)\b/u.test(searchable)) flags.add("llm_sdk");
  if (/\b(?:langchain|langgraph|crewai)\b/u.test(searchable))
    flags.add("agent_framework");
  if (hasPath(/(^|\/)prompts?\//u)) flags.add("prompt_management");
  if (
    hasPath(/(^|\/)claude\.md$/u) ||
    hasPath(/(^|\/)\.cursor\//u) ||
    hasPath(/(^|\/)\.claude\//u) ||
    hasPath(/(^|\/)\.gemini\//u)
  )
    flags.add("ai_tool");
  if (
    hasPath(/(^|\/)schemas?\/[^/]*\.sql$/u) ||
    hasPath(/(^|\/)alembic\//u) ||
    hasPath(/(^|\/)migrations?\//u)
  )
    flags.add("db");
  if ((input.readmeSize ?? 0) > 1024) flags.add("documentation");

  return REPOSITORY_FLAGS.filter((flag) => flags.has(flag));
}

export function summarizeReadme(readme: string | null, maximum = 1200) {
  if (!readme) return null;
  const plainText = readme
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#>*_`~|=-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (plainText.length <= maximum) return plainText;
  return `${plainText.slice(0, maximum - 1).trimEnd()}…`;
}
