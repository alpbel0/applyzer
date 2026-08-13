import "server-only";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/db/client";
import { CRITERION_KEYS } from "@/lib/schemas/evaluation";

const weightShape = Object.fromEntries(
  CRITERION_KEYS.map((key) => [key, z.number().min(0).max(1)]),
) as Record<(typeof CRITERION_KEYS)[number], z.ZodNumber>;

export const rubricWeightsSchema = z
  .object(weightShape)
  .strict()
  .superRefine((weights, context) => {
    const total = CRITERION_KEYS.reduce((sum, key) => sum + weights[key], 0);
    if (Math.abs(total - 1) > 0.000001) {
      context.addIssue({
        code: "custom",
        message: "Rubric weights must total 1.",
      });
    }
  });

export const rubricVersionSchema = z
  .object({
    id: z.number().int().positive(),
    weights: rubricWeightsSchema,
    is_active: z.literal(true),
    description: z.string().nullable(),
  })
  .strict();

export type RubricVersion = z.infer<typeof rubricVersionSchema>;

const rubricHistorySchema = rubricVersionSchema
  .omit({ is_active: true })
  .extend({
    is_active: z.boolean(),
    created_at: z.string(),
  })
  .strict();

export type RubricHistoryItem = z.infer<typeof rubricHistorySchema>;

export async function getActiveRubric() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("rubric_versions")
    .select("id, weights, is_active, description")
    .eq("is_active", true)
    .single();
  if (error) throw error;
  return rubricVersionSchema.parse(data);
}

export async function getRubricHistory(): Promise<RubricHistoryItem[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("rubric_versions")
    .select("id, weights, is_active, description, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((item) => rubricHistorySchema.parse(item));
}

export async function countEvaluatedApplications() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("application_id");
  if (error) throw error;
  return new Set(data.map((item) => item.application_id)).size;
}

export async function createRubricVersionAndRecalculate(input: {
  weights: z.infer<typeof rubricWeightsSchema>;
  description?: string | null;
}) {
  const weights = rubricWeightsSchema.parse(input.weights);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "create_rubric_version_and_recalculate",
    { p_weights: weights, p_description: input.description ?? null },
  );
  if (error) throw error;
  return z
    .object({
      rubric_version_id: z.number().int().positive(),
      recalculated_count: z.number().int().nonnegative(),
    })
    .parse(data);
}
