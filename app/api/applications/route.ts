import { createApplication } from "@/lib/db/applications";
import { createSupabaseAdminClient } from "@/lib/db/client";
import {
  hasValidCvSignature,
  sanitizeCvFileName,
} from "@/lib/cv/validate-upload";
import {
  applicationFormSchema,
  MAX_CV_SIZE_BYTES,
} from "@/lib/schemas/application";
import { scheduleApplicationProcessing } from "@/lib/worker/schedule";

const MAX_MULTIPART_SIZE_BYTES = MAX_CV_SIZE_BYTES + 64 * 1024;

type ErrorResponse = {
  error: string;
  field_errors?: Record<string, string[]>;
};

function errorResponse(body: ErrorResponse, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return errorResponse(
      { error: "Başvuru multipart/form-data olarak gönderilmelidir." },
      415,
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_MULTIPART_SIZE_BYTES
  ) {
    return errorResponse({ error: "CV en fazla 4 MiB olabilir." }, 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse({ error: "Başvuru verisi okunamadı." }, 400);
  }

  if (String(formData.get("company_website") ?? "").trim() !== "") {
    return errorResponse({ error: "Başvuru gönderilemedi." }, 400);
  }

  const cv = formData.get("cv");
  if (!(cv instanceof File)) {
    return errorResponse(
      {
        error: "CV dosyası gerekli.",
        field_errors: { cv: ["CV dosyası gerekli."] },
      },
      400,
    );
  }

  if (cv.size > MAX_CV_SIZE_BYTES) {
    return errorResponse(
      {
        error: "CV en fazla 4 MiB olabilir.",
        field_errors: { cv: ["CV en fazla 4 MiB olabilir."] },
      },
      413,
    );
  }

  const parsed = applicationFormSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    department_year: formData.get("department_year"),
    technologies: formData.get("technologies"),
    bonus_tools: formData.getAll("bonus_tools"),
    links: formData.get("links"),
    self_introduction: formData.get("self_introduction"),
    llm_experience: formData.get("llm_experience"),
    office_days_per_week: formData.get("office_days_per_week"),
    privacy_consent: formData.get("privacy_consent") === "true",
    cv: { name: cv.name, size: cv.size, type: cv.type },
  });

  if (!parsed.success) {
    return errorResponse(
      {
        error: "Lütfen hatalı alanları kontrol edin.",
        field_errors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const cvBytes = new Uint8Array(await cv.arrayBuffer());
  if (!hasValidCvSignature(cvBytes, parsed.data.cv.type)) {
    return errorResponse(
      {
        error: "CV içeriği geçerli bir PDF dosyası değil.",
        field_errors: { cv: ["Dosya içeriği geçersiz."] },
      },
      415,
    );
  }

  const applicationId = crypto.randomUUID();
  const safeFileName = sanitizeCvFileName(cv.name);
  const storagePath = `${applicationId}/${safeFileName}`;
  const supabase = createSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from("cvs")
    .upload(storagePath, cvBytes, {
      contentType: parsed.data.cv.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("CV upload failed", uploadError);
    return errorResponse(
      { error: "CV yüklenemedi. Lütfen yeniden deneyin." },
      500,
    );
  }

  try {
    const application = await createApplication({
      ...parsed.data,
      id: applicationId,
      cvFileName: cv.name,
      cvStoragePath: storagePath,
    });

    scheduleApplicationProcessing(applicationId);

    return Response.json(
      { application_number: application.application_number },
      { status: 201 },
    );
  } catch (error) {
    console.error("Application insert failed", error);
    const { error: cleanupError } = await supabase.storage
      .from("cvs")
      .remove([storagePath]);
    if (cleanupError) {
      console.error("CV cleanup failed", cleanupError);
    }

    return errorResponse(
      { error: "Başvuru kaydedilemedi. Lütfen yeniden deneyin." },
      500,
    );
  }
}
