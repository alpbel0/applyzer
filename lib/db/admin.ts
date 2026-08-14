import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";

export type ApplicationStatus = "pending" | "evaluating" | "done" | "failed";
export type Recommendation = "yes" | "maybe" | "no";
export type DepartmentFit = "match" | "related" | "unrelated";

export type AdminApplicationRow = {
  id: string;
  application_number: number;
  full_name: string;
  department_year: string;
  status: ApplicationStatus;
  created_at: string;
  final_score: number | null;
  final_recommendation: Recommendation | null;
  department_fit: DepartmentFit | null;
  duplicate_number: number | null;
  injection_detected: boolean;
};

export type StoredCriterion = {
  score: number;
  evidence: string;
};

export type StoredScoreBreakdown = {
  key: string;
  score: number;
  weight: number;
  contribution: number;
};

export type AdminEvaluation = {
  id: string;
  rubric_version_id: number;
  criteria: Record<string, StoredCriterion>;
  strengths: string[];
  risks: string[];
  rationale: string;
  cv_summary: string;
  department_fit: DepartmentFit;
  location_note: string | null;
  model_recommendation: Recommendation;
  final_score: number;
  score_breakdown: StoredScoreBreakdown[];
  final_recommendation: Recommendation;
  override_reason: string | null;
  injection_detected: boolean;
  injection_note: string | null;
  model: string;
  tool_call_count: number;
  duration_ms: number | null;
  evaluation_origin: "agent" | "recalculation";
  source_evaluation_id: string | null;
  rank: number | null;
  ranked_candidate_count: number;
  created_at: string;
};

export type AdminEmailDraft = {
  id: string;
  application_id: string;
  evaluation_id: string;
  subject: string;
  body: string;
  draft_type: Recommendation;
  is_sent: boolean;
  sent_at: string | null;
  demo_mode: boolean;
  provider_id: string | null;
  error: string | null;
  created_at: string;
};

export type AdminApplicationDetail = {
  application: {
    id: string;
    application_number: number;
    full_name: string;
    email: string;
    department_year: string;
    technologies: string;
    bonus_tools: string[];
    links: string | null;
    self_introduction: string;
    llm_experience: string;
    office_days_per_week: string;
    location_note: string | null;
    consent_at: string;
    cv_file_name: string;
    status: ApplicationStatus;
    error_message: string | null;
    created_at: string;
  };
  evaluations: AdminEvaluation[];
  emails: AdminEmailDraft[];
  enrichment: Array<{
    id: string;
    source: string;
    url: string;
    status: string;
    data: unknown;
    error: string | null;
    fetched_at: string;
    duration_ms: number | null;
  }>;
};

function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getAdminApplications(): Promise<AdminApplicationRow[]> {
  const supabase = createSupabaseAdminClient();
  const [applicationsResult, evaluationsResult] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, application_number, full_name, email, department_year, status, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("evaluations")
      .select(
        "application_id, final_score, final_recommendation, department_fit, injection_detected, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);
  if (applicationsResult.error) throw applicationsResult.error;
  if (evaluationsResult.error) throw evaluationsResult.error;

  const latestEvaluations = new Map<
    string,
    (typeof evaluationsResult.data)[number]
  >();
  for (const evaluation of evaluationsResult.data) {
    if (!latestEvaluations.has(evaluation.application_id)) {
      latestEvaluations.set(evaluation.application_id, evaluation);
    }
  }

  const applicationsByEmail = new Map<string, string[]>();
  for (const application of [...applicationsResult.data].reverse()) {
    const email = application.email.trim().toLocaleLowerCase("en-US");
    const ids = applicationsByEmail.get(email) ?? [];
    ids.push(application.id);
    applicationsByEmail.set(email, ids);
  }

  return applicationsResult.data.map((application) => {
    const latest = latestEvaluations.get(application.id);
    const email = application.email.trim().toLocaleLowerCase("en-US");
    const matchingIds = applicationsByEmail.get(email) ?? [];
    const duplicateIndex = matchingIds.indexOf(application.id) + 1;
    return {
      id: application.id,
      application_number: application.application_number,
      full_name: application.full_name,
      department_year: application.department_year,
      status: application.status as ApplicationStatus,
      created_at: application.created_at,
      final_score: numberOrNull(latest?.final_score),
      final_recommendation:
        (latest?.final_recommendation as Recommendation | undefined) ?? null,
      department_fit:
        (latest?.department_fit as DepartmentFit | undefined) ?? null,
      duplicate_number: matchingIds.length > 1 ? duplicateIndex : null,
      injection_detected: latest?.injection_detected ?? false,
    };
  });
}

export async function getAdminApplicationDetail(
  applicationId: string,
): Promise<AdminApplicationDetail | null> {
  const supabase = createSupabaseAdminClient();
  const [
    applicationResult,
    evaluationsResult,
    enrichmentResult,
    rankingResult,
    emailsResult,
  ] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, application_number, full_name, email, department_year, technologies, bonus_tools, links, self_introduction, llm_experience, office_days_per_week, location_note, consent_at, cv_file_name, status, error_message, created_at",
      )
      .eq("id", applicationId)
      .maybeSingle(),
    supabase
      .from("evaluations")
      .select(
        "id, rubric_version_id, criteria, strengths, risks, rationale, cv_summary, department_fit, location_note, model_recommendation, final_score, score_breakdown, final_recommendation, override_reason, injection_detected, injection_note, model, tool_call_count, duration_ms, evaluation_origin, source_evaluation_id, created_at",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("enrichment_results")
      .select("id, source, url, status, data, error, fetched_at, duration_ms")
      .eq("application_id", applicationId)
      .order("fetched_at", { ascending: true }),
    supabase
      .from("evaluations")
      .select("id, application_id, rubric_version_id, final_score, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("emails")
      .select(
        "id, application_id, evaluation_id, subject, body, draft_type, is_sent, sent_at, demo_mode, provider_id, error, created_at",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
  ]);

  if (applicationResult.error) throw applicationResult.error;
  if (evaluationsResult.error) throw evaluationsResult.error;
  if (enrichmentResult.error) throw enrichmentResult.error;
  if (rankingResult.error) throw rankingResult.error;
  if (emailsResult.error) throw emailsResult.error;
  if (!applicationResult.data) return null;

  const latestByRubricAndApplication = new Map<
    string,
    (typeof rankingResult.data)[number]
  >();
  for (const evaluation of rankingResult.data) {
    const key = `${evaluation.rubric_version_id}:${evaluation.application_id}`;
    if (!latestByRubricAndApplication.has(key)) {
      latestByRubricAndApplication.set(key, evaluation);
    }
  }

  const rankingsByRubric = new Map<
    number,
    Map<string, { rank: number; count: number }>
  >();
  for (const evaluation of latestByRubricAndApplication.values()) {
    const rubricId = evaluation.rubric_version_id;
    if (!rankingsByRubric.has(rubricId)) {
      const candidates = [...latestByRubricAndApplication.values()]
        .filter((item) => item.rubric_version_id === rubricId)
        .sort(
          (left, right) => Number(right.final_score) - Number(left.final_score),
        );
      rankingsByRubric.set(
        rubricId,
        new Map(
          candidates.map((candidate, index) => [
            candidate.application_id,
            { rank: index + 1, count: candidates.length },
          ]),
        ),
      );
    }
  }

  return {
    application:
      applicationResult.data as AdminApplicationDetail["application"],
    evaluations: evaluationsResult.data.map((evaluation) => {
      const ranking = rankingsByRubric
        .get(evaluation.rubric_version_id)
        ?.get(applicationId);
      return {
        ...evaluation,
        final_score: Number(evaluation.final_score),
        rank: ranking?.rank ?? null,
        ranked_candidate_count: ranking?.count ?? 0,
      } as AdminEvaluation;
    }),
    emails: emailsResult.data as AdminEmailDraft[],
    enrichment: enrichmentResult.data as AdminApplicationDetail["enrichment"],
  };
}
