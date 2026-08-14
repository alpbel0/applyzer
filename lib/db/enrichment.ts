import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";
import type { StoredEnrichmentResult } from "@/lib/enrichment/types";

export async function replaceEnrichmentResults(
  applicationId: string,
  results: StoredEnrichmentResult[],
) {
  const supabase = createSupabaseAdminClient();
  const { error: deleteError } = await supabase
    .from("enrichment_results")
    .delete()
    .eq("application_id", applicationId);
  if (deleteError) throw deleteError;
  if (results.length === 0) return;

  const { error: insertError } = await supabase
    .from("enrichment_results")
    .insert(
      results.map((result) => ({
        application_id: applicationId,
        source: result.source,
        url: result.url,
        status: result.status,
        data: result.data,
        error: result.error,
        duration_ms: result.duration_ms,
      })),
    );
  if (insertError) throw insertError;
}
