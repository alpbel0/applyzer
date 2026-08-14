const RESERVED_TAG_PATTERN =
  /<\/?(?:form_data|cv_file|untrusted_cv_text|enrichment|system|developer|assistant|user|tool)(?:\s[^>]*)?>/giu;

const INJECTION_PATTERNS = [
  {
    label: "instruction_override_en",
    pattern:
      /\b(?:ignore|disregard|forget)\b.{0,60}\b(?:previous|prior|above|system|developer)\b.{0,30}\b(?:instruction|message|prompt)s?\b/giu,
  },
  {
    label: "instruction_override_tr",
    pattern:
      /(?:önceki|yukarıdaki|sistem|geliştirici).{0,60}(?:talimat|mesaj|prompt)(?:ı|ıni|ını|ları|larını)?.{0,30}(?:yoksay|unut|dinleme|uygulama)/giu,
  },
  {
    label: "score_manipulation_en",
    pattern:
      /\b(?:give|assign|set|rate)\b.{0,50}\b(?:candidate|applicant|me)\b.{0,50}\b(?:100|5\s*\/\s*5|yes)\b/giu,
  },
  {
    label: "score_manipulation_tr",
    pattern:
      /\b(?:bu\s+adaya|adaya|bana)\b.{0,50}\b(?:100|5\s*\/\s*5|tam\s+puan|evet)\b.{0,30}\b(?:ver|yaz|ata)?\b/giu,
  },
  {
    label: "role_or_boundary_tag",
    pattern: RESERVED_TAG_PATTERN,
  },
] as const;

export type InjectionDetection = {
  detected: boolean;
  signals: string[];
};

export function sanitizeUntrustedText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .replace(RESERVED_TAG_PATTERN, (tag) =>
      tag.replaceAll("<", "‹").replaceAll(">", "›"),
    );
}

export function sanitizeUntrustedValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeUntrustedText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUntrustedValue(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeUntrustedValue(item),
      ]),
    ) as T;
  }
  return value;
}

export function detectPromptInjection(
  values: Array<string | null | undefined>,
) {
  const text = values
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const signals = INJECTION_PATTERNS.flatMap(({ label, pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text) ? [label] : [];
  });

  return {
    detected: signals.length > 0,
    signals,
  } satisfies InjectionDetection;
}
