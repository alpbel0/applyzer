import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";
import type { ValidatedApplicationForm } from "@/lib/schemas/application";

type CreateApplicationInput = Omit<ValidatedApplicationForm, "cv"> & {
  id: string;
  cvFileName: string;
  cvStoragePath: string;
};

export async function createApplication(input: CreateApplicationInput) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("applications")
    .insert({
      id: input.id,
      full_name: input.full_name,
      email: input.email,
      department_year: input.department_year,
      technologies: input.technologies,
      bonus_tools: input.bonus_tools,
      links: input.links ?? null,
      self_introduction: input.self_introduction,
      llm_experience: input.llm_experience,
      office_days_per_week: input.office_days_per_week,
      consent_at: new Date().toISOString(),
      cv_storage_path: input.cvStoragePath,
      cv_file_name: input.cvFileName,
      status: "pending",
    })
    .select("application_number")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
