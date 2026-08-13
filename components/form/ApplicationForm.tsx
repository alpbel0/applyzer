"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { z } from "zod";

import { CharCounter } from "@/components/form/CharCounter";
import { FileUpload } from "@/components/form/FileUpload";
import { OfficeLocationModal } from "@/components/form/OfficeLocationModal";
import { ToolCheckboxes } from "@/components/form/ToolCheckboxes";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { applicationFormSchema } from "@/lib/schemas/application";

type FieldErrors = Record<string, string[]>;
type TextFieldName =
  | "full_name"
  | "email"
  | "department_year"
  | "technologies"
  | "links"
  | "self_introduction"
  | "llm_experience"
  | "office_days_per_week";

const fieldSchemas: Record<TextFieldName, z.ZodType> = {
  full_name: applicationFormSchema.shape.full_name,
  email: applicationFormSchema.shape.email,
  department_year: applicationFormSchema.shape.department_year,
  technologies: applicationFormSchema.shape.technologies,
  links: applicationFormSchema.shape.links,
  self_introduction: applicationFormSchema.shape.self_introduction,
  llm_experience: applicationFormSchema.shape.llm_experience,
  office_days_per_week: applicationFormSchema.shape.office_days_per_week,
};

function firstError(errors: FieldErrors, field: string) {
  return errors[field]?.[0];
}

function FieldError({ errors, field }: { errors: FieldErrors; field: string }) {
  const message = firstError(errors, field);
  return message ? (
    <p id={`${field}-error`} className="form-error">
      {message}
    </p>
  ) : null;
}

function inputState(errors: FieldErrors, field: string) {
  return firstError(errors, field)
    ? "form-control form-control-error"
    : "form-control";
}

export function ApplicationForm() {
  const router = useRouter();
  const [selfIntroduction, setSelfIntroduction] = useState("");
  const [llmExperience, setLlmExperience] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateField(name: TextFieldName, value: string) {
    const result = fieldSchemas[name].safeParse(value);
    setErrors((current) => {
      const next = { ...current };
      if (result.success) delete next[name];
      else next[name] = result.error.issues.map((issue) => issue.message);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    if (cv) formData.set("cv", cv);

    const candidate = {
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
      cv: cv ? { name: cv.name, size: cv.size, type: cv.type } : undefined,
    };
    const validation = applicationFormSchema.safeParse(candidate);

    if (!validation.success) {
      setErrors(validation.error.flatten().fieldErrors);
      setGeneralError("Lütfen işaretlenen alanları kontrol edin.");
      requestAnimationFrame(() => {
        form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
      return;
    }

    setErrors({});
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        application_number?: number;
        error?: string;
        field_errors?: FieldErrors;
      };

      if (!response.ok || !payload.application_number) {
        setErrors(payload.field_errors ?? {});
        setGeneralError(
          payload.error ?? "Başvuru gönderilemedi. Lütfen yeniden deneyin.",
        );
        return;
      }

      router.push(
        `/tesekkurler?application_number=${encodeURIComponent(payload.application_number)}`,
      );
    } catch {
      setGeneralError(
        "Bağlantı kurulamadı. İnternet bağlantını kontrol edip yeniden dene.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="company_website">Şirket web sitesi</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <section aria-labelledby="personal-heading">
        <div className="section-kicker">01</div>
        <h2 id="personal-heading" className="form-section-title">
          Seni tanıyalım
        </h2>
        <p className="form-section-copy">
          Temel iletişim ve eğitim bilgilerin.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="full_name">
              Ad soyad <span aria-hidden="true">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              className={inputState(errors, "full_name")}
              aria-invalid={Boolean(firstError(errors, "full_name"))}
              aria-describedby={
                firstError(errors, "full_name") ? "full_name-error" : undefined
              }
              onBlur={(event) => validateField("full_name", event.target.value)}
            />
            <FieldError errors={errors} field="full_name" />
          </div>
          <div>
            <label className="form-label" htmlFor="email">
              E-posta <span aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={inputState(errors, "email")}
              aria-invalid={Boolean(firstError(errors, "email"))}
              aria-describedby={
                firstError(errors, "email") ? "email-error" : undefined
              }
              onBlur={(event) => validateField("email", event.target.value)}
            />
            <FieldError errors={errors} field="email" />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label" htmlFor="department_year">
              Bölüm / sınıf <span aria-hidden="true">*</span>
            </label>
            <input
              id="department_year"
              name="department_year"
              type="text"
              placeholder="Örn. Bilgisayar Mühendisliği, 3. sınıf"
              autoComplete="organization-title"
              className={inputState(errors, "department_year")}
              aria-invalid={Boolean(firstError(errors, "department_year"))}
              aria-describedby={
                firstError(errors, "department_year")
                  ? "department_year-error"
                  : undefined
              }
              onBlur={(event) =>
                validateField("department_year", event.target.value)
              }
            />
            <FieldError errors={errors} field="department_year" />
          </div>
        </div>
      </section>

      <div className="form-divider" />

      <section aria-labelledby="experience-heading">
        <div className="section-kicker">02</div>
        <h2 id="experience-heading" className="form-section-title">
          Teknik deneyimin
        </h2>
        <p className="form-section-copy">
          Neler kullandığını ve nasıl öğrendiğini anlat.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <label className="form-label" htmlFor="technologies">
              Kullandığın teknolojiler <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="technologies"
              name="technologies"
              rows={4}
              placeholder="Örn. TypeScript, Python, React, REST API, PostgreSQL..."
              className={inputState(errors, "technologies")}
              aria-invalid={Boolean(firstError(errors, "technologies"))}
              aria-describedby={
                firstError(errors, "technologies")
                  ? "technologies-error"
                  : undefined
              }
              onBlur={(event) =>
                validateField("technologies", event.target.value)
              }
            />
            <FieldError errors={errors} field="technologies" />
          </div>

          <ToolCheckboxes />

          <div>
            <label className="form-label" htmlFor="links">
              Bağlantılar <span className="form-optional">Opsiyonel</span>
            </label>
            <input
              id="links"
              name="links"
              type="text"
              placeholder="GitHub, LinkedIn, portfolyo veya Kaggle bağlantıların"
              className={inputState(errors, "links")}
              aria-invalid={Boolean(firstError(errors, "links"))}
              aria-describedby="links-hint"
              onBlur={(event) => validateField("links", event.target.value)}
            />
            <p id="links-hint" className="form-hint">
              Birden fazlaysa boşluk veya virgülle ayırabilirsin.
            </p>
            <FieldError errors={errors} field="links" />
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <label className="form-label" htmlFor="self_introduction">
                Kendini tanıt <span aria-hidden="true">*</span>
              </label>
              <CharCounter current={selfIntroduction.length} maximum={600} />
            </div>
            <textarea
              id="self_introduction"
              name="self_introduction"
              rows={5}
              maxLength={600}
              placeholder="Kendinden kısaca bahset — ne okuyorsun, neyle ilgileniyorsun, neden bu staj?"
              className={inputState(errors, "self_introduction")}
              value={selfIntroduction}
              aria-invalid={Boolean(firstError(errors, "self_introduction"))}
              aria-describedby={
                firstError(errors, "self_introduction")
                  ? "self_introduction-error"
                  : undefined
              }
              onChange={(event) => setSelfIntroduction(event.target.value)}
              onBlur={(event) =>
                validateField("self_introduction", event.target.value)
              }
            />
            <FieldError errors={errors} field="self_introduction" />
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <label className="form-label" htmlFor="llm_experience">
                LLM / agent deneyimin <span aria-hidden="true">*</span>
              </label>
              <CharCounter current={llmExperience.length} maximum={1500} />
            </div>
            <textarea
              id="llm_experience"
              name="llm_experience"
              rows={7}
              maxLength={1500}
              placeholder="LLM veya agent ile yaptığın bir şeyi anlat — ne yaptın, nerede takıldın, nasıl çözdün."
              className={inputState(errors, "llm_experience")}
              value={llmExperience}
              aria-invalid={Boolean(firstError(errors, "llm_experience"))}
              aria-describedby={
                firstError(errors, "llm_experience")
                  ? "llm_experience-error"
                  : undefined
              }
              onChange={(event) => setLlmExperience(event.target.value)}
              onBlur={(event) =>
                validateField("llm_experience", event.target.value)
              }
            />
            <FieldError errors={errors} field="llm_experience" />
          </div>
        </div>
      </section>

      <div className="form-divider" />

      <section aria-labelledby="availability-heading">
        <div className="section-kicker">03</div>
        <h2 id="availability-heading" className="form-section-title">
          Çalışma düzeni ve CV
        </h2>
        <p className="form-section-copy">
          Ankara’daki hibrit düzene uygunluğun ve özgeçmişin.
        </p>

        <div className="mt-6 space-y-6">
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="form-label" htmlFor="office_days_per_week">
                Haftada kaç gün ofise gelebilirsin?{" "}
                <span aria-hidden="true">*</span>
              </label>
              <select
                id="office_days_per_week"
                name="office_days_per_week"
                defaultValue=""
                className={inputState(errors, "office_days_per_week")}
                aria-invalid={Boolean(
                  firstError(errors, "office_days_per_week"),
                )}
                aria-describedby={
                  firstError(errors, "office_days_per_week")
                    ? "office_days_per_week-error"
                    : undefined
                }
                onChange={(event) =>
                  validateField("office_days_per_week", event.target.value)
                }
              >
                <option value="" disabled>
                  Bir seçenek seç
                </option>
                <option value="1">Haftada 1 gün</option>
                <option value="2">Haftada 2 gün</option>
                <option value="3">Haftada 3 gün</option>
                <option value="4-5">Haftada 4–5 gün</option>
                <option value="relocation_needed">
                  Şu an başka şehirdeyim, ayarlamam gerekir
                </option>
              </select>
              <FieldError errors={errors} field="office_days_per_week" />
            </div>
            <OfficeLocationModal />
          </div>

          <FileUpload
            file={cv}
            error={firstError(errors, "cv")}
            onFileChange={(file) => {
              setCv(file);
              const result = file
                ? applicationFormSchema.shape.cv.safeParse({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                  })
                : null;
              setErrors((current) => {
                const next = { ...current };
                if (result?.success) delete next.cv;
                else if (result)
                  next.cv = result.error.issues.map((issue) => issue.message);
                return next;
              });
            }}
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dedfdc] bg-[#fbfaf6] p-4 text-sm leading-6 text-[#4c5568] transition has-checked:border-[#e2a243] has-checked:bg-[#fff8eb]">
            <input
              type="checkbox"
              name="privacy_consent"
              value="true"
              className="mt-1 size-4 shrink-0 accent-[#e49626]"
              aria-invalid={Boolean(firstError(errors, "privacy_consent"))}
              aria-describedby={
                firstError(errors, "privacy_consent")
                  ? "privacy_consent-error"
                  : undefined
              }
              onChange={(event) => {
                setErrors((current) => {
                  const next = { ...current };
                  if (event.target.checked) delete next.privacy_consent;
                  return next;
                });
              }}
            />
            <span>
              Bilgilerimin ve CV’min yalnızca staj başvurumu değerlendirmek
              amacıyla işlenmesini kabul ediyorum.
              <span aria-hidden="true"> *</span>
            </span>
          </label>
          <FieldError errors={errors} field="privacy_consent" />
        </div>
      </section>

      {generalError ? (
        <div
          role="alert"
          className="rounded-2xl border border-[#efc0c0] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#9d3030]"
        >
          {generalError}
        </div>
      ) : null}

      <div className="rounded-2xl bg-[#16213e] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm leading-6 text-white/70">
          Gönderimden sonra başvuru numaranı ekranda göreceksin.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full bg-[#f0a43a] text-[#16213e] shadow-none hover:bg-[#ffb753] focus-visible:ring-[#f0a43a] sm:mt-0 sm:w-auto sm:min-w-44"
        >
          {isSubmitting ? (
            <>
              <Spinner /> Gönderiliyor
            </>
          ) : (
            "Başvuruyu gönder →"
          )}
        </Button>
      </div>
    </form>
  );
}
