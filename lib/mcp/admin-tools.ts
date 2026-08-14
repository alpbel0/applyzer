import "server-only";

import { extractPdfLinkMaterial } from "@/lib/cv/parse";
import { createSupabaseAdminClient } from "@/lib/db/client";
import {
  getAdminApplicationDetail,
  getAdminApplications,
  type AdminApplicationRow,
} from "@/lib/db/admin";
import {
  detectPromptInjection,
  sanitizeUntrustedText,
} from "@/lib/evaluation/sanitize";

const CV_SIGNED_URL_DURATION_SECONDS = 300;
export const MAX_EMBEDDED_CV_SIZE_BYTES = 2.5 * 1024 * 1024;

export async function searchAdminApplications(input: {
  query?: string;
  status?: AdminApplicationRow["status"];
  recommendation?: NonNullable<AdminApplicationRow["final_recommendation"]>;
  minimumScore?: number;
  maximumScore?: number;
  sort: "newest" | "score_desc" | "score_asc";
  limit: number;
}) {
  const normalizedQuery = input.query?.trim().toLocaleLowerCase("tr-TR");
  const applications = (await getAdminApplications())
    .filter(
      (item) =>
        !normalizedQuery ||
        item.full_name.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
        item.department_year
          .toLocaleLowerCase("tr-TR")
          .includes(normalizedQuery) ||
        String(item.application_number) === normalizedQuery,
    )
    .filter((item) => !input.status || item.status === input.status)
    .filter(
      (item) =>
        !input.recommendation ||
        item.final_recommendation === input.recommendation,
    )
    .filter(
      (item) =>
        input.minimumScore === undefined ||
        (item.final_score !== null && item.final_score >= input.minimumScore),
    )
    .filter(
      (item) =>
        input.maximumScore === undefined ||
        (item.final_score !== null && item.final_score <= input.maximumScore),
    );

  if (input.sort !== "newest") {
    applications.sort((left, right) => {
      const leftScore = left.final_score ?? -1;
      const rightScore = right.final_score ?? -1;
      return input.sort === "score_desc"
        ? rightScore - leftScore
        : leftScore - rightScore;
    });
  }

  return applications.slice(0, input.limit);
}

export async function compareAdminApplications(applicationIds: string[]) {
  const details = await Promise.all(
    applicationIds.map((id) => getAdminApplicationDetail(id)),
  );
  return {
    candidates: details.flatMap((detail) => {
      if (!detail) return [];
      const latest = detail.evaluations[0] ?? null;
      return [
        {
          application: detail.application,
          latest_evaluation: latest,
          source_summary: detail.enrichment.map((item) => ({
            source: item.source,
            url: item.url,
            status: item.status,
          })),
        },
      ];
    }),
    not_found: applicationIds.filter((_, index) => !details[index]),
  };
}

export async function getAdminDashboardSummary() {
  const applications = await getAdminApplications();
  const scored = applications.filter(
    (item): item is AdminApplicationRow & { final_score: number } =>
      item.final_score !== null,
  );
  return {
    total: applications.length,
    by_status: Object.fromEntries(
      ["pending", "evaluating", "done", "failed"].map((status) => [
        status,
        applications.filter((item) => item.status === status).length,
      ]),
    ),
    by_recommendation: Object.fromEntries(
      ["yes", "maybe", "no"].map((recommendation) => [
        recommendation,
        applications.filter(
          (item) => item.final_recommendation === recommendation,
        ).length,
      ]),
    ),
    evaluated: scored.length,
    average_score:
      scored.length === 0
        ? null
        : Number(
            (
              scored.reduce((sum, item) => sum + item.final_score, 0) /
              scored.length
            ).toFixed(2),
          ),
    injection_warning_count: applications.filter(
      (item) => item.injection_detected,
    ).length,
  };
}

export async function getAdminCvLink(applicationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, application_number, full_name, cv_file_name, cv_storage_path")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) throw applicationError;
  if (!application) return null;

  const { data, error } = await supabase.storage
    .from("cvs")
    .createSignedUrl(
      application.cv_storage_path,
      CV_SIGNED_URL_DURATION_SECONDS,
      { download: application.cv_file_name },
    );
  if (error || !data?.signedUrl) {
    throw error ?? new Error("CV signed URL could not be created.");
  }
  return {
    application_id: application.id,
    application_number: application.application_number,
    candidate_name: application.full_name,
    file_name: application.cv_file_name,
    signed_url: data.signedUrl,
    expires_in_seconds: CV_SIGNED_URL_DURATION_SECONDS,
    expires_at: new Date(
      Date.now() + CV_SIGNED_URL_DURATION_SECONDS * 1000,
    ).toISOString(),
  };
}

export async function getAdminCvContent(applicationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, application_number, full_name, cv_file_name, cv_storage_path")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) throw applicationError;
  if (!application) return null;

  const { data, error } = await supabase.storage
    .from("cvs")
    .download(application.cv_storage_path);
  if (error || !data) throw error ?? new Error("CV could not be downloaded.");
  if (data.size > MAX_EMBEDDED_CV_SIZE_BYTES) {
    throw new Error(
      "CV MCP içine gömülemeyecek kadar büyük. delivery=resource_link kullanın.",
    );
  }
  return {
    application_id: application.id,
    application_number: application.application_number,
    candidate_name: application.full_name,
    file_name: application.cv_file_name,
    byte_size: data.size,
    base64: Buffer.from(await data.arrayBuffer()).toString("base64"),
  };
}

export async function getAdminCvText(
  applicationId: string,
  maxCharacters: number,
) {
  const supabase = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, application_number, full_name, cv_file_name, cv_storage_path")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) throw applicationError;
  if (!application) return null;

  const { data, error } = await supabase.storage
    .from("cvs")
    .download(application.cv_storage_path);
  if (error || !data) throw error ?? new Error("CV could not be downloaded.");
  const material = await extractPdfLinkMaterial(
    new Uint8Array(await data.arrayBuffer()),
  );
  const fullText = sanitizeUntrustedText(material.text).trim();
  if (!fullText) {
    throw new Error(
      "PDF'de seçilebilir metin bulunamadı. CV taranmış/görsel olabilir; kayıtlı değerlendirme özetini kullanın.",
    );
  }
  const text = fullText.slice(0, maxCharacters);
  return {
    application_id: application.id,
    application_number: application.application_number,
    candidate_name: application.full_name,
    file_name: application.cv_file_name,
    text,
    original_character_count: fullText.length,
    returned_character_count: text.length,
    truncated: text.length < fullText.length,
    embedded_urls: material.embeddedUrls,
    injection_detection: detectPromptInjection([fullText]),
  };
}
