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
