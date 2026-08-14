export const LINK_SOURCES = [
  "github",
  "kaggle",
  "medium",
  "linkedin",
  "generic",
] as const;

export type LinkSource = (typeof LINK_SOURCES)[number];

export type ExtractedLink = {
  url: string;
  source: LinkSource;
};

const URL_PATTERN =
  /(?:https?:\/\/|www\.|(?:github|kaggle|medium|linkedin)\.com\/)[^\s<>"'`]+/giu;
const TRAILING_PUNCTUATION = /[.,;:!?\])}>]+$/gu;

const LABELED_USERNAME_PATTERNS: Array<{
  baseUrl: string;
  pattern: RegExp;
}> = [
  {
    baseUrl: "https://github.com/",
    pattern:
      /\bgithub\s*(?:profile|profil)?\s*[:\-]\s*@?([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)(?![\w./])/giu,
  },
  {
    baseUrl: "https://kaggle.com/",
    pattern:
      /\bkaggle\s*(?:profile|profil)?\s*[:\-]\s*@?([a-z\d_-]{1,40})(?![\w./])/giu,
  },
  {
    baseUrl: "https://medium.com/@",
    pattern:
      /\bmedium\s*(?:profile|profil)?\s*[:\-]\s*@?([a-z\d_.-]{1,60})(?![\w/])/giu,
  },
];

export function classifyLink(rawUrl: string): LinkSource | "skipped" {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "skipped";

  const hostname = new URL(normalized).hostname.replace(/^www\./u, "");
  if (hostname === "github.com") return "github";
  if (hostname === "kaggle.com") return "kaggle";
  if (hostname === "medium.com" || hostname.endsWith(".medium.com")) {
    return "medium";
  }
  if (hostname === "linkedin.com") return "linkedin";
  return "generic";
}

export function normalizeUrl(rawUrl: string): string | null {
  const cleaned = rawUrl.trim().replace(TRAILING_PUNCTUATION, "");
  if (!cleaned) return null;

  const candidate = /^https?:\/\//iu.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.toString();
  } catch {
    return null;
  }
}

function collectLabeledProfiles(text: string) {
  const urls: string[] = [];

  for (const { baseUrl, pattern } of LABELED_USERNAME_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const username = match[1];
      if (username && username !== "http" && username !== "https") {
        urls.push(`${baseUrl}${username}`);
      }
    }
  }

  return urls;
}

export function extractLinks(
  sources: Array<string | null | undefined>,
): ExtractedLink[] {
  const candidates = sources.flatMap((source) => {
    if (!source) return [];
    return [
      ...(source.match(URL_PATTERN) ?? []),
      ...collectLabeledProfiles(source),
    ];
  });
  const unique = new Map<string, ExtractedLink>();

  for (const candidate of candidates) {
    const url = normalizeUrl(candidate);
    if (!url) continue;
    const source = classifyLink(url);
    if (source === "skipped") continue;

    const key = url.toLocaleLowerCase("en-US");
    if (!unique.has(key)) unique.set(key, { url, source });
  }

  return [...unique.values()];
}
