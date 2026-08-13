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
import { rubricWeightsSchema } from "@/lib/db/rubric";

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
  location_note: "İstanbul'dayım, kabul edilirsem Ankara'ya taşınabilirim.",
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
  it("accepts remote-only as the zero-office-day option", () => {
    expect(
      applicationFormSchema.safeParse({
        ...validApplication,
        office_days_per_week: "remote_only",
      }).success,
    ).toBe(true);

    expect(
      applicationFormSchema.safeParse({
        ...validApplication,
        office_days_per_week: "0",
      }).success,
    ).toBe(false);
  });

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
        location_note: "x".repeat(301),
      }).success,
    ).toBe(false);
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
    expect(
      applicationFormSchema.safeParse({
        ...validApplication,
        cv: {
          name: "ada-cv.docx",
          size: 256_000,
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      }).success,
    ).toBe(false);
  });
});

describe("rubricWeightsSchema", () => {
  it("requires all seven weights to total exactly one", () => {
    const weights = {
      rest_api: 0.15,
      llm_experience: 0.2,
      agentic_mcp: 0.2,
      bonus_tools: 0.15,
      verifiability: 0.15,
      learning_signal: 0.1,
      cv_quality: 0.05,
    };
    expect(rubricWeightsSchema.safeParse(weights).success).toBe(true);
    expect(
      rubricWeightsSchema.safeParse({ ...weights, cv_quality: 0.1 }).success,
    ).toBe(false);
    expect(
      rubricWeightsSchema.safeParse({ ...weights, extra: 0 }).success,
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
  it("accepts the Phase 4 GitHub payload", () => {
    const repository = {
      name: "applyzer",
      full_name: "ada/applyzer",
      url: "https://github.com/ada/applyzer",
      description: "Candidate evaluation pipeline",
      primary_language: "TypeScript",
      size_kb: 512,
      last_push: "2026-08-13T12:30:00Z",
      license: "MIT",
      default_branch: "main",
      empty: false,
      readme_summary: "A documented evaluation pipeline.",
      flags: ["tests", "ci", "llm_sdk", "documentation"],
      languages: { TypeScript: 0.9, CSS: 0.1 },
      detail_status: "ok",
    };

    expect(
      enrichmentResultSchema.parse({
        source: "github",
        url: "https://github.com/ada/applyzer",
        status: "ok",
        error: null,
        duration_ms: 240,
        data: {
          username: "ada",
          account_age_months: null,
          public_repositories: null,
          non_fork_repositories: null,
          followers: null,
          last_activity: "2026-08-13T12:30:00Z",
          languages: { TypeScript: 1 },
          repositories: [repository],
          repository_metadata: [],
          github_requests: 4,
          requested_repository: repository,
        },
      }).source,
    ).toBe("github");
  });

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
