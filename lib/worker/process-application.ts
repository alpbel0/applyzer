import "server-only";

import { extractLinks } from "@/lib/cv/extract-links";
import { extractPdfLinkMaterial } from "@/lib/cv/parse";
import { createSupabaseAdminClient } from "@/lib/db/client";

export type WorkerResult = {
  application_id: string;
  link_count: number;
  status: "evaluating" | "failed" | "ignored";
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
): Promise<WorkerResult | null> {
  const applicationId =
    requestedApplicationId ?? (await findOldestPendingApplicationId());
  if (!applicationId) return null;

  const supabase = createSupabaseAdminClient();
  const { data: application, error: claimError } = await supabase
    .from("applications")
    .update({ status: "evaluating", error_message: null })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select("id, links, cv_storage_path")
    .maybeSingle();

  if (claimError) throw claimError;
  if (!application) {
    return { application_id: applicationId, link_count: 0, status: "ignored" };
  }

  try {
    const { data: cv, error: downloadError } = await supabase.storage
      .from("cvs")
      .download(application.cv_storage_path);
    if (downloadError || !cv) {
      throw downloadError ?? new Error("CV download returned no data");
    }

    const material = await extractPdfLinkMaterial(
      new Uint8Array(await cv.arrayBuffer()),
    );
    const extractedLinks = extractLinks([
      application.links,
      material.text,
      ...material.embeddedUrls,
    ]);

    const { error: updateError } = await supabase
      .from("applications")
      .update({
        extracted_links: extractedLinks,
        error_message: null,
        status: "evaluating",
      })
      .eq("id", applicationId);
    if (updateError) throw updateError;

    return {
      application_id: applicationId,
      link_count: extractedLinks.length,
      status: "evaluating",
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

    return { application_id: applicationId, link_count: 0, status: "failed" };
  }
}
