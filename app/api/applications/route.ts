import {
  ApplicationSubmissionError,
  submitApplication,
} from "@/lib/applications/submit";
import { MAX_CV_SIZE_BYTES } from "@/lib/schemas/application";

export const maxDuration = 300;

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

  const form = {
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    department_year: formData.get("department_year"),
    technologies: formData.get("technologies"),
    bonus_tools: formData.getAll("bonus_tools"),
    links: formData.get("links"),
    self_introduction: formData.get("self_introduction"),
    llm_experience: formData.get("llm_experience"),
    office_days_per_week: formData.get("office_days_per_week"),
    location_note: formData.get("location_note"),
    privacy_consent: formData.get("privacy_consent") === "true",
    cv: { name: cv.name, size: cv.size, type: cv.type },
  };

  const cvBytes = new Uint8Array(await cv.arrayBuffer());
  try {
    const application = await submitApplication({ form, cvBytes });

    return Response.json(
      { application_number: application.application_number },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApplicationSubmissionError) {
      return errorResponse(
        { error: error.message, field_errors: error.fieldErrors },
        error.status,
      );
    }
    console.error("Unexpected application submission failure", error);
    return errorResponse({ error: "Başvuru kaydedilemedi." }, 500);
  }
}
