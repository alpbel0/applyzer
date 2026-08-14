import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/client";
import {
  buildEmailDraft,
  type DraftType,
  type EmailDraft,
} from "@/lib/email/templates";

export type StoredEmailDraft = EmailDraft & {
  id: string;
  application_id: string;
  evaluation_id: string;
  draft_type: DraftType;
  is_sent: boolean;
  sent_at: string | null;
  demo_mode: boolean;
  provider_id: string | null;
  error: string | null;
  created_at: string;
};

export async function createEmailDraftRecord(input: {
  applicationId: string;
  evaluationId: string;
  draftType: DraftType;
  draft: EmailDraft;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("emails")
    .upsert(
      {
        application_id: input.applicationId,
        evaluation_id: input.evaluationId,
        draft_type: input.draftType,
        subject: input.draft.subject,
        body: input.draft.body,
      },
      { onConflict: "evaluation_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data as { id: string } | null;
}

export async function updateEmailDraftType(input: {
  emailId: string;
  fullName: string;
  draftType: DraftType;
}) {
  const supabase = createSupabaseAdminClient();
  const draft = buildEmailDraft(input.fullName, input.draftType);
  const { data, error } = await supabase
    .from("emails")
    .update({
      draft_type: input.draftType,
      subject: draft.subject,
      body: draft.body,
      error: null,
    })
    .eq("id", input.emailId)
    .eq("is_sent", false)
    .is("provider_id", null)
    .select("id, subject, body, draft_type")
    .maybeSingle();
  if (error) throw error;
  return data as (EmailDraft & { id: string; draft_type: DraftType }) | null;
}

export async function claimEmailForSending(input: {
  emailId: string;
  claimId: string;
  demoMode: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("emails")
    .update({
      provider_id: input.claimId,
      demo_mode: input.demoMode,
      error: null,
    })
    .eq("id", input.emailId)
    .eq("is_sent", false)
    .is("provider_id", null)
    .select("id, application_id, subject, body")
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    application_id: string;
    subject: string;
    body: string;
  } | null;
}

export async function completeEmailSending(input: {
  emailId: string;
  claimId: string;
  providerId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("emails")
    .update({
      is_sent: true,
      sent_at: new Date().toISOString(),
      provider_id: input.providerId,
      error: null,
    })
    .eq("id", input.emailId)
    .eq("provider_id", input.claimId)
    .eq("is_sent", false)
    .select("id, sent_at, demo_mode, provider_id")
    .single();
  if (error) throw error;
  return data as {
    id: string;
    sent_at: string;
    demo_mode: boolean;
    provider_id: string;
  };
}

export async function failEmailSending(input: {
  emailId: string;
  claimId: string;
  error: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("emails")
    .update({ provider_id: null, error: input.error })
    .eq("id", input.emailId)
    .eq("provider_id", input.claimId)
    .eq("is_sent", false);
  if (error) throw error;
}

export async function getEmailApplication(emailId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: email, error: emailError } = await supabase
    .from("emails")
    .select("application_id, is_sent, provider_id")
    .eq("id", emailId)
    .maybeSingle();
  if (emailError) throw emailError;
  if (!email) return null;

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("full_name, email")
    .eq("id", email.application_id)
    .single();
  if (applicationError) throw applicationError;
  return { email, application };
}
