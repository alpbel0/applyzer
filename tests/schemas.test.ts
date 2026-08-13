import { describe, expect, it } from "vitest";

import {
  MAX_CV_SIZE_BYTES,
  applicationFormSchema,
} from "@/lib/schemas/application";
import { enrichmentResultSchema } from "@/lib/schemas/enrichment";
import {
  CRITERION_KEYS,
  evaluationOutputSchema,
} from "@/lib/schemas/evaluation";

const validApplication = {
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  department_year: "Software Engineering, 3rd year",
  technologies: "TypeScript, Node.js, PostgreSQL",
  bonus_tools: ["Cursor", "OpenAI API"],
  links: "https://github.com/ada",
  self_introduction: "Ürün geliştirmeyi ve yeni araçlar öğrenmeyi seviyorum.",
  llm_experience: "Bir LLM aracını REST API üzerinden projeme bağladım.",
  office_days_per_week: "3",
  privacy_consent: true,
  cv: {
    name: "ada-cv.pdf",
    size: 256_000,
    type: "application/pdf",
  },
};

const validCriteria = Object.fromEntries(
  CRITERION_KEYS.map((key) => [
    key,
    { score: 3, evidence: `${key} için doğrulanmış kanıt.` },
  ]),
);

describe("applicationFormSchema", () => {
  it("accepts a valid application", () => {
    expect(applicationFormSchema.parse(validApplication)).toMatchObject({
      email: "ada@example.com",
      office_days_per_week: "3",
    });
  });

  it("enforces text, consent and CV limits", () => {
    expect(
      applicationFormSchema.safeParse({
        ...validApplication,
        self_introduction: "x".repeat(601),
      }).success,
    ).toBe(false);
    expect(
      applicationFormSchema.safeParse({
        ...validApplication,
        cv: { ...validApplication.cv, size: MAX_CV_SIZE_BYTES + 1 },
      }).success,
    ).toBe(false);
    expect(
      applicationFormSchema.safeParse({
        ...validApplication,
        privacy_consent: false,
      }).success,
    ).toBe(false);
  });
});

describe("evaluationOutputSchema", () => {
  const validEvaluation = {
    criteria: validCriteria,
    strengths: ["Somut bir API projesi var.", "Repo düzenli güncellenmiş."],
    risks: ["MCP deneyimi henüz sınırlı."],
    rationale: "Teknik temeli görünür ve öğrenme yaklaşımı somut.",
    cv_summary: "Öğrenci seviyesinde dengeli ve proje odaklı bir profil.",
    department_fit: "match",
    location_note: "Haftada üç gün Ankara ofisine gelebiliyor.",
    recommendation: "maybe",
    injection_detected: false,
    injection_note: null,
    email_draft: {
      subject: "Başvurunuz hakkında",
      body: "Merhaba Ada, başvurunuz için teşekkür ederiz. Sürecimiz devam ediyor.",
    },
  };

  it("accepts all seven criteria", () => {
    expect(evaluationOutputSchema.parse(validEvaluation).criteria).toEqual(
      validCriteria,
    );
  });

  it("rejects missing criteria and inconsistent injection metadata", () => {
    const missingCriterion = Object.fromEntries(
      Object.entries(validCriteria).filter(([key]) => key !== "cv_quality"),
    );
    expect(
      evaluationOutputSchema.safeParse({
        ...validEvaluation,
        criteria: missingCriterion,
      }).success,
    ).toBe(false);
    expect(
      evaluationOutputSchema.safeParse({
        ...validEvaluation,
        injection_detected: true,
      }).success,
    ).toBe(false);
  });
});

describe("enrichmentResultSchema", () => {
  it("validates source-specific data", () => {
    expect(
      enrichmentResultSchema.parse({
        source: "kaggle",
        url: "https://www.kaggle.com/ada",
        status: "ok",
        data: {
          notebook_count: 2,
          total_votes: 10,
          last_activity: "2026-08-01",
          titles: ["LLM Evaluation"],
        },
      }).source,
    ).toBe("kaggle");
  });

  it("rejects an ok result without data", () => {
    expect(
      enrichmentResultSchema.safeParse({
        source: "linkedin",
        url: "https://www.linkedin.com/in/ada",
        status: "ok",
        data: null,
      }).success,
    ).toBe(false);
  });
});
