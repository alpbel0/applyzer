import "server-only";

import {
  hasValidCvSignature,
  sanitizeCvFileName,
} from "@/lib/cv/validate-upload";
import { createApplication } from "@/lib/db/applications";
import { createSupabaseAdminClient } from "@/lib/db/client";
import { applicationFormSchema } from "@/lib/schemas/application";
import { scheduleApplicationProcessing } from "@/lib/worker/schedule";

export class ApplicationSubmissionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 | 500,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApplicationSubmissionError";
  }
}

export async function submitApplication(input: {
  form: unknown;
  cvBytes: Uint8Array;
}) {
  const parsed = applicationFormSchema.safeParse(input.form);
  if (!parsed.success) {
    throw new ApplicationSubmissionError(
      "Lütfen hatalı alanları kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  if (!hasValidCvSignature(input.cvBytes, parsed.data.cv.type)) {
    throw new ApplicationSubmissionError(
      "CV içeriği geçerli bir PDF dosyası değil.",
      415,
      { cv: ["Dosya içeriği geçersiz."] },
    );
  }

  const applicationId = crypto.randomUUID();
  const storagePath = `${applicationId}/${sanitizeCvFileName(parsed.data.cv.name)}`;
  const supabase = createSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from("cvs")
    .upload(storagePath, input.cvBytes, {
      contentType: parsed.data.cv.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("CV upload failed", uploadError);
    throw new ApplicationSubmissionError(
      "CV yüklenemedi. Lütfen yeniden deneyin.",
      500,
    );
  }

  try {
    const application = await createApplication({
      ...parsed.data,
      id: applicationId,
      cvFileName: parsed.data.cv.name,
      cvStoragePath: storagePath,
    });
    scheduleApplicationProcessing(applicationId);
    return {
      application_id: applicationId,
      application_number: application.application_number,
    };
  } catch (error) {
    console.error("Application insert failed", error);
    const { error: cleanupError } = await supabase.storage
      .from("cvs")
      .remove([storagePath]);
    if (cleanupError) console.error("CV cleanup failed", cleanupError);
    throw new ApplicationSubmissionError(
      "Başvuru kaydedilemedi. Lütfen yeniden deneyin.",
      500,
    );
  }
}
