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
  "prompt_management",
  "ai_tool",
  "db",
  "documentation",
]);

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Tarih YYYY-MM-DD olmalı.");

export const githubRepositorySchema = z
  .object({
    name: z.string().trim().min(1),
    full_name: z.string().trim().min(3),
    url: z.url(),
    description: z.string().nullable(),
    primary_language: z.string().nullable(),
    size_kb: z.number().nonnegative(),
    last_push: z.iso.datetime().nullable(),
    license: z.string().nullable(),
    default_branch: z.string().trim().min(1),
    empty: z.boolean(),
    readme_summary: z.string().nullable(),
    flags: z.array(repositoryFlagSchema),
    languages: z.record(z.string(), z.number().min(0).max(1)),
    detail_status: z.enum(["ok", "partial"]),
  })
  .strict();

export const githubRepositoryMetadataSchema = z
  .object({
    name: z.string().trim().min(1),
    url: z.url(),
    description: z.string().nullable(),
    primary_language: z.string().nullable(),
    size_kb: z.number().nonnegative(),
    last_push: z.iso.datetime().nullable(),
    license: z.string().nullable(),
    empty: z.boolean(),
  })
  .strict();

export const githubEnrichmentDataSchema = z
  .object({
    username: z.string().trim().min(1),
    account_age_months: z.number().int().nonnegative().nullable(),
    public_repositories: z.number().int().nonnegative().nullable(),
    non_fork_repositories: z.number().int().nonnegative().nullable(),
    followers: z.number().int().nonnegative().nullable(),
    last_activity: z.iso.datetime().nullable(),
    languages: z.record(z.string(), z.number().min(0).max(1)),
    repositories: z.array(githubRepositorySchema),
    repository_metadata: z.array(githubRepositoryMetadataSchema),
    github_requests: z.number().int().nonnegative(),
    requested_repository: githubRepositorySchema.nullable().optional(),
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
