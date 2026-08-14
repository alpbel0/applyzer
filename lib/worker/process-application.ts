import "server-only";

import { extractLinks } from "@/lib/cv/extract-links";
import { extractPdfLinkMaterial } from "@/lib/cv/parse";
import { createSupabaseAdminClient } from "@/lib/db/client";
import { replaceEnrichmentResults } from "@/lib/db/enrichment";
import { enrichLinks } from "@/lib/enrichment";
import { evaluateApplication } from "@/lib/evaluation/evaluate";

export type WorkerResult = {
  application_id: string;
  enrichment_count: number;
  link_count: number;
  status: "done" | "evaluating" | "failed" | "ignored";
};

async function findOldestPendingApplicationId() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id as string | undefined;
}

export async function processApplicationLinks(
  requestedApplicationId?: string,
  options?: { alreadyClaimed?: boolean },
): Promise<WorkerResult | null> {
  const applicationId =
    requestedApplicationId ?? (await findOldestPendingApplicationId());
  if (!applicationId) return null;

  const supabase = createSupabaseAdminClient();
  const applicationQuery = options?.alreadyClaimed
    ? supabase
        .from("applications")
        .select("id, links, cv_storage_path")
        .eq("id", applicationId)
        .eq("status", "evaluating")
        .maybeSingle()
    : supabase
        .from("applications")
        .update({ status: "evaluating", error_message: null })
        .eq("id", applicationId)
        .eq("status", "pending")
        .select("id, links, cv_storage_path")
        .maybeSingle();
  const { data: application, error: claimError } = await applicationQuery;

  if (claimError) throw claimError;
  if (!application) {
    return {
      application_id: applicationId,
      enrichment_count: 0,
      link_count: 0,
      status: "ignored",
    };
  }

  try {
    const { data: cv, error: downloadError } = await supabase.storage
      .from("cvs")
      .download(application.cv_storage_path);
    if (downloadError || !cv) {
      throw downloadError ?? new Error("CV download returned no data");
    }

    const cvBytes = new Uint8Array(await cv.arrayBuffer());
    const material = await extractPdfLinkMaterial(cvBytes.slice());
    const extractedLinks = extractLinks([
      application.links,
      material.text,
      ...material.embeddedUrls,
    ]);
    const enrichmentResults = await enrichLinks(extractedLinks);
    await replaceEnrichmentResults(applicationId, enrichmentResults);

    const { error: updateError } = await supabase
      .from("applications")
      .update({
        extracted_links: extractedLinks,
        error_message: null,
        status: "evaluating",
      })
      .eq("id", applicationId);
    if (updateError) throw updateError;

    const evaluation = await evaluateApplication(applicationId, {
      cvBytes,
      pdfText: material.text,
    });

    return {
      application_id: applicationId,
      enrichment_count: enrichmentResults.length,
      link_count: extractedLinks.length,
      status: evaluation.status,
    };
  } catch (error) {
    console.error("Application link extraction failed", error);
    const { error: failureUpdateError } = await supabase
      .from("applications")
      .update({
        error_message: "CV bağlantıları işlenemedi.",
        status: "failed",
      })
      .eq("id", applicationId);
    if (failureUpdateError) {
      console.error(
        "Application failure status update failed",
        failureUpdateError,
      );
    }

    return {
      application_id: applicationId,
      enrichment_count: 0,
      link_count: 0,
      status: "failed",
    };
  }
}
