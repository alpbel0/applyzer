import { z } from "zod";

export const CRITERION_KEYS = [
  "rest_api",
  "llm_experience",
  "agentic_mcp",
  "bonus_tools",
  "verifiability",
  "learning_signal",
  "cv_quality",
] as const;

export const recommendationSchema = z.enum(["yes", "maybe", "no"]);
export const departmentFitSchema = z.enum(["match", "related", "unrelated"]);

export const criterionEvaluationSchema = z
  .object({
    score: z.number().int().min(0).max(5),
    evidence: z.string().trim().min(1, "Her kriter için kanıt gerekli."),
  })
  .strict();

export const criteriaSchema = z
  .object(
    Object.fromEntries(
      CRITERION_KEYS.map((key) => [key, criterionEvaluationSchema]),
    ) as Record<
      (typeof CRITERION_KEYS)[number],
      typeof criterionEvaluationSchema
    >,
  )
  .strict();

const wordCount = (value: string) =>
  value.trim() === "" ? 0 : value.trim().split(/\s+/u).length;

export const emailDraftSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(1)
      .refine((value) => wordCount(value) <= 6, {
        message: "E-posta konusu en fazla 6 kelime olabilir.",
      }),
    body: z
      .string()
      .trim()
      .min(1)
      .refine((value) => wordCount(value) <= 120, {
        message: "E-posta gövdesi en fazla 120 kelime olabilir.",
      }),
  })
  .strict();

export const evaluationOutputSchema = z
  .object({
    criteria: criteriaSchema,
    strengths: z
      .array(z.string().trim().min(1))
      .max(4)
      .refine((items) => items.length === 0 || items.length >= 2, {
        message: "Güçlü yanlar boş veya 2-4 maddelik olmalı.",
      }),
    risks: z.array(z.string().trim().min(1)).min(1).max(4),
    rationale: z.string().trim().min(1),
    cv_summary: z.string().trim().min(1),
    department_fit: departmentFitSchema,
    location_note: z.string().trim().min(1),
    recommendation: recommendationSchema,
    injection_detected: z.boolean(),
    injection_note: z.string().trim().min(1).nullable(),
    email_draft: emailDraftSchema,
  })
  .strict()
  .superRefine((evaluation, context) => {
    if (evaluation.injection_detected && evaluation.injection_note === null) {
      context.addIssue({
        code: "custom",
        path: ["injection_note"],
        message: "Injection tespit edildiğinde açıklama gerekli.",
      });
    }

    if (!evaluation.injection_detected && evaluation.injection_note !== null) {
      context.addIssue({
        code: "custom",
        path: ["injection_note"],
        message: "Injection yoksa açıklama null olmalı.",
      });
    }
  });

export type CriterionKey = (typeof CRITERION_KEYS)[number];
export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;
