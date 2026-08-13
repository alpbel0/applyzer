import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";
import type { ScoreResult } from "@/lib/evaluation/score";
import type { EvaluationOutput } from "@/lib/schemas/evaluation";

export async function createEvaluationRecord(input: {
  applicationId: string;
  rubricVersionId: number;
  evaluation: EvaluationOutput;
  score: ScoreResult;
  model: string;
  toolCallCount: number;
  durationMs: number;
  rawResponses: unknown[];
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      application_id: input.applicationId,
      rubric_version_id: input.rubricVersionId,
      criteria: input.evaluation.criteria,
      strengths: input.evaluation.strengths,
      risks: input.evaluation.risks,
      rationale: input.evaluation.rationale,
      cv_summary: input.evaluation.cv_summary,
      department_fit: input.evaluation.department_fit,
      location_note: input.evaluation.location_note,
      model_recommendation: input.score.model_recommendation,
      final_score: input.score.final_score,
      score_breakdown: input.score.score_breakdown,
      final_recommendation: input.score.final_recommendation,
      override_reason: input.score.override_reason,
      injection_detected: input.evaluation.injection_detected,
      injection_note: input.evaluation.injection_note,
      model: input.model,
      tool_call_count: input.toolCallCount,
      duration_ms: input.durationMs,
      raw_response: input.rawResponses,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function recordEvaluationAttempts(input: {
  applicationId: string;
  evaluationId: string | null;
  runId: string;
  model: string;
  toolCallCount: number;
  durationMs: number;
  rawResponses: unknown[];
  success: boolean;
  errorMessage?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const responses = input.rawResponses.length > 0 ? input.rawResponses : [null];
  const { error } = await supabase.from("evaluation_attempts").insert(
    responses.map((rawResponse, index) => {
      const isLast = index === responses.length - 1;
      return {
        application_id: input.applicationId,
        evaluation_id: input.evaluationId,
        run_id: input.runId,
        attempt_number: index + 1,
        outcome: isLast ? (input.success ? "success" : "failed") : "received",
        model: input.model,
        tool_call_count: input.toolCallCount,
        duration_ms: isLast ? input.durationMs : null,
        raw_response: rawResponse,
        error_message: isLast ? (input.errorMessage ?? null) : null,
      };
    }),
  );
  if (error) throw error;
}

export async function linkEvaluationAttempts(
  runId: string,
  evaluationId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("evaluation_attempts")
    .update({ evaluation_id: evaluationId })
    .eq("run_id", runId);
  if (error) throw error;
}
