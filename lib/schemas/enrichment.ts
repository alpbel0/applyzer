import { z } from "zod";

export const enrichmentStatusSchema = z.enum([
  "ok",
  "partial",
  "unreachable",
  "skipped",
]);

export const repositoryFlagSchema = z.enum([
  "tests",
  "ci",
  "docker",
  "mcp",
  "llm_sdk",
  "agent_framework",
  "prompt_yonetimi",
  "ai_araci",
  "db",
  "dokuman",
]);

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Tarih YYYY-MM-DD olmalı.");

export const githubRepositorySchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().nullable(),
    language: z.string().nullable(),
    size_kb: z.number().nonnegative(),
    last_push: dateSchema,
    license: z.string().nullable(),
    readme_summary: z.string(),
    flags: z.array(repositoryFlagSchema),
  })
  .strict();

export const githubEnrichmentDataSchema = z
  .object({
    username: z.string().trim().min(1),
    account_age_months: z.number().int().nonnegative(),
    public_repositories: z.number().int().nonnegative(),
    non_fork_repositories: z.number().int().nonnegative(),
    followers: z.number().int().nonnegative(),
    last_activity: dateSchema,
    languages: z.record(z.string(), z.number().min(0).max(1)),
    repositories: z.array(githubRepositorySchema),
  })
  .strict();

export const kaggleEnrichmentDataSchema = z
  .object({
    notebook_count: z.number().int().nonnegative(),
    total_votes: z.number().int().nonnegative(),
    last_activity: dateSchema.nullable(),
    titles: z.array(z.string().trim().min(1)),
  })
  .strict();

export const mediumEnrichmentDataSchema = z
  .object({
    titles: z.array(z.string().trim().min(1)),
    last_activity: dateSchema.nullable(),
    summaries: z.array(z.string().trim().min(1)),
  })
  .strict();

export const genericEnrichmentDataSchema = z
  .object({
    title: z.string().trim().min(1).nullable(),
    summary: z.string().trim().min(1),
  })
  .strict();

const resultMetadata = {
  url: z.url(),
  status: enrichmentStatusSchema,
  error: z.string().trim().min(1).nullable().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
} as const;

export const enrichmentResultSchema = z
  .discriminatedUnion("source", [
    z
      .object({
        source: z.literal("github"),
        ...resultMetadata,
        data: githubEnrichmentDataSchema.nullable(),
      })
      .strict(),
    z
      .object({
        source: z.literal("kaggle"),
        ...resultMetadata,
        data: kaggleEnrichmentDataSchema.nullable(),
      })
      .strict(),
    z
      .object({
        source: z.literal("medium"),
        ...resultMetadata,
        data: mediumEnrichmentDataSchema.nullable(),
      })
      .strict(),
    z
      .object({
        source: z.literal("generic"),
        ...resultMetadata,
        data: genericEnrichmentDataSchema.nullable(),
      })
      .strict(),
    z
      .object({
        source: z.literal("linkedin"),
        ...resultMetadata,
        data: genericEnrichmentDataSchema.nullable(),
      })
      .strict(),
  ])
  .superRefine((result, context) => {
    if (["ok", "partial"].includes(result.status) && result.data === null) {
      context.addIssue({
        code: "custom",
        path: ["data"],
        message: "Başarılı veya kısmi sonuçta data gerekli.",
      });
    }
  });

export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>;
