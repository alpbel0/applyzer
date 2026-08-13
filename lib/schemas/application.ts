import { z } from "zod";

export const MAX_CV_SIZE_BYTES = 4 * 1024 * 1024;

export const BONUS_TOOLS = [
  "n8n",
  "Zapier",
  "Make",
  "Apify",
  "OpenAI API",
  "Anthropic API",
  "Cursor",
  "Lovable",
] as const;

export const OFFICE_DAY_OPTIONS = [
  "1",
  "2",
  "3",
  "4-5",
  "relocation_needed",
] as const;

export const CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const optionalTrimmedText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().optional(),
);

export const cvUploadSchema = z
  .object({
    name: z.string().trim().min(1, "CV dosya adı gerekli."),
    size: z
      .number()
      .int()
      .positive("CV boş olamaz.")
      .max(MAX_CV_SIZE_BYTES, "CV en fazla 4 MiB olabilir."),
    type: z.enum(CV_MIME_TYPES, {
      error: "CV yalnızca PDF veya DOCX olabilir.",
    }),
  })
  .superRefine((file, context) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const expectedExtension = file.type === "application/pdf" ? "pdf" : "docx";

    if (extension !== expectedExtension) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "CV uzantısı ve MIME tipi eşleşmiyor.",
      });
    }
  });

export const applicationInputSchema = z
  .object({
    full_name: z.string().trim().min(1, "Ad soyad gerekli."),
    email: z
      .email("Geçerli bir e-posta adresi girin.")
      .max(254, "E-posta adresi çok uzun."),
    department_year: z.string().trim().min(1, "Bölüm ve sınıf gerekli."),
    technologies: z.string().trim().min(1, "Teknolojiler alanı gerekli."),
    bonus_tools: z
      .array(z.enum(BONUS_TOOLS))
      .max(BONUS_TOOLS.length)
      .default([])
      .refine(
        (tools) => new Set(tools).size === tools.length,
        "Bonus araçlar tekrarlanamaz.",
      ),
    links: optionalTrimmedText,
    self_introduction: z
      .string()
      .trim()
      .min(1, "Kendini tanıt alanı gerekli.")
      .max(600, "Kendini tanıt alanı en fazla 600 karakter olabilir."),
    llm_experience: z
      .string()
      .trim()
      .min(1, "LLM/agent deneyimi alanı gerekli.")
      .max(1500, "LLM/agent deneyimi en fazla 1500 karakter olabilir."),
    office_days_per_week: z.enum(OFFICE_DAY_OPTIONS, {
      error: "Geçerli bir ofis günü seçeneği seçin.",
    }),
    privacy_consent: z.literal(true, {
      error: "Başvuru için veri işleme onayı gerekli.",
    }),
  })
  .strict();

export const applicationFormSchema = applicationInputSchema.extend({
  cv: cvUploadSchema,
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export type ApplicationFormInput = z.input<typeof applicationFormSchema>;
export type ValidatedApplicationForm = z.output<typeof applicationFormSchema>;
