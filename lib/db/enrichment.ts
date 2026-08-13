import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";
import type { GitHubEnrichmentResult } from "@/lib/enrichment/github";

export async function replaceGitHubEnrichmentResults(
  applicationId: string,
  results: GitHubEnrichmentResult[],
) {
  const supabase = createSupabaseAdminClient();
  const { error: deleteError } = await supabase
    .from("enrichment_results")
    .delete()
    .eq("application_id", applicationId)
    .eq("source", "github");
  if (deleteError) throw deleteError;
  if (results.length === 0) return;

  const { error: insertError } = await supabase
    .from("enrichment_results")
    .insert(
      results.map((result) => ({
        application_id: applicationId,
        source: "github",
        url: result.url,
        status: result.status,
        data: result.data,
        error: result.error,
        duration_ms: result.duration_ms,
      })),
    );
  if (insertError) throw insertError;
}
