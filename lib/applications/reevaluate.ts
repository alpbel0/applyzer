import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";
import { scheduleApplicationReevaluation } from "@/lib/worker/schedule";

export async function requestApplicationReevaluation(applicationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: "evaluating", error_message: null })
    .eq("id", applicationId)
    .in("status", ["done", "failed"])
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  scheduleApplicationReevaluation(applicationId);
  return true;
}
