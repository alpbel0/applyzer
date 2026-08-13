import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { EnrichmentPanel } from "@/components/admin/EnrichmentPanel";
import { ScoreBreakdown } from "@/components/admin/ScoreBreakdown";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ReevaluateButton } from "@/components/admin/ReevaluateButton";
import { RubricComparison } from "@/components/admin/RubricComparison";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAdminApplicationDetail,
  type AdminEvaluation,
  type Recommendation,
} from "@/lib/db/admin";

export const dynamic = "force-dynamic";

const recommendationLabels: Record<Recommendation, string> = {
  yes: "Evet",
  maybe: "Belki",
  no: "Hayır",
};

const departmentLabels = {
  match: "Bölüm eşleşiyor",
  related: "İlgili bölüm",
  unrelated: "Farklı bölüm",
} as const;

const officeLabels: Record<string, string> = {
  "1": "Haftada 1 gün",
  "2": "Haftada 2 gün",
  "3": "Haftada 3 gün",
  "4-5": "Haftada 4–5 gün",
  relocation_needed: "Başka şehirde, düzenleme/taşınma gerekli",
  remote_only: "Yalnızca uzaktan çalışabilir",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.08em] text-[#858b97] uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[#3f4960]">
        {value?.trim() || "Belirtilmemiş"}
      </p>
    </div>
  );
}

function EvaluationSummary({ evaluation }: { evaluation: AdminEvaluation }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl bg-[#16213e] p-5 text-white">
        <p className="text-xs text-white/60">Nihai skor</p>
        <p className="mt-1 text-4xl font-black tabular-nums">
          {evaluation.final_score.toFixed(2)}
        </p>
      </div>
      <div className="rounded-2xl border border-[#dedfdc] bg-white p-5">
        <p className="text-xs text-[#7d8492]">Model önerisi</p>
        <p className="mt-1 text-xl font-black">
          {recommendationLabels[evaluation.model_recommendation]}
        </p>
      </div>
      <div className="rounded-2xl border border-[#e0bd7f] bg-[#fff7e8] p-5">
        <p className="text-xs text-[#8c6a35]">Nihai öneri</p>
        <p className="mt-1 text-xl font-black text-[#8b5409]">
          {recommendationLabels[evaluation.final_recommendation]}
        </p>
      </div>
    </div>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getAdminApplicationDetail(id);
  if (!detail) notFound();

  const { application, evaluations, enrichment } = detail;
  const latest = evaluations[0];

  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/admin"
          className="text-sm font-bold text-[#85510c] hover:underline"
        >
          ← Başvurulara dön
        </Link>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-[#ac680d]">
                #{application.application_number}
              </span>
              <StatusBadge status={application.status} />
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              {application.full_name}
            </h1>
            <p className="mt-2 text-sm text-[#707887]">
              {application.email} · {formatDate(application.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReevaluateButton
              applicationId={application.id}
              evaluating={application.status === "evaluating"}
            />
            <a
              href={`/api/cv/${application.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-[#16213e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#263353]"
            >
              CV’yi aç · 5 dk
            </a>
          </div>
        </div>

        {application.error_message ? (
          <div className="mt-7 rounded-2xl border border-[#edb5b5] bg-[#fff2f2] p-4 text-sm font-semibold text-[#993c3c]">
            İşlem hatası: {application.error_message}
          </div>
        ) : null}

        {latest?.injection_detected ? (
          <div
            role="alert"
            className="mt-7 rounded-2xl border-2 border-[#e58427] bg-[#fff3df] p-5"
          >
            <p className="font-black text-[#8e4905]">
              Prompt injection şüphesi
            </p>
            <p className="mt-2 text-sm leading-6 text-[#774b20]">
              Aday girdisinde değerlendirme talimatlarını etkilemeye yönelik bir
              sinyal tespit edildi. Bu uyarı puanı veya öneriyi otomatik olarak
              değiştirmez.
            </p>
            {latest.injection_note ? (
              <p className="mt-2 text-sm font-semibold text-[#774b20]">
                {latest.injection_note}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 grid gap-7 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-7">
            <Card className="p-6">
              <h2 className="text-xl font-black">Form bilgileri</h2>
              <div className="mt-6 space-y-6">
                <TextBlock
                  label="Bölüm / sınıf"
                  value={application.department_year}
                />
                <TextBlock
                  label="Teknolojiler"
                  value={application.technologies}
                />
                <TextBlock
                  label="Bonus araçlar"
                  value={application.bonus_tools.join(", ") || null}
                />
                <TextBlock label="Bağlantılar" value={application.links} />
                <TextBlock
                  label="Kendini tanıt"
                  value={application.self_introduction}
                />
                <TextBlock
                  label="LLM / agent deneyimi"
                  value={application.llm_experience}
                />
                <TextBlock
                  label="Ofise gelebileceği gün"
                  value={
                    officeLabels[application.office_days_per_week] ??
                    application.office_days_per_week
                  }
                />
                <TextBlock
                  label="Konum ve çalışma düzeni notu"
                  value={application.location_note}
                />
                <TextBlock
                  label="CV dosyası"
                  value={application.cv_file_name}
                />
                <TextBlock
                  label="Veri işleme onayı"
                  value={formatDate(application.consent_at)}
                />
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-black">Enrichment kaynakları</h2>
              <div className="mt-5">
                <EnrichmentPanel rows={enrichment} />
              </div>
            </Card>
          </div>

          <div className="space-y-7">
            {latest ? (
              <>
                <EvaluationSummary evaluation={latest} />

                <Card className="p-6">
                  <h2 className="text-xl font-black">Rubric karşılaştırması</h2>
                  <p className="mt-1 text-sm text-[#7b8290]">
                    Aynı kriter puanlarının farklı rubric sürümlerindeki sonucu.
                  </p>
                  <div className="mt-5">
                    <RubricComparison evaluations={evaluations} />
                  </div>
                </Card>

                {latest.override_reason ? (
                  <div className="rounded-2xl border border-[#c9cfea] bg-[#f3f5ff] p-4 text-sm leading-6 text-[#48557d]">
                    <strong>Sistem override:</strong> {latest.override_reason}
                  </div>
                ) : null}

                <Card className="p-6">
                  <h2 className="text-xl font-black">Karar özeti</h2>
                  <div className="mt-5 space-y-5">
                    <TextBlock label="Gerekçe" value={latest.rationale} />
                    <TextBlock label="CV özeti" value={latest.cv_summary} />
                    <TextBlock
                      label="Konum yorumu"
                      value={latest.location_note}
                    />
                    <TextBlock
                      label="Bölüm uyumu"
                      value={departmentLabels[latest.department_fit]}
                    />
                  </div>
                </Card>

                <div>
                  <h2 className="text-xl font-black">Kriter kırılımı</h2>
                  <div className="mt-4">
                    <ScoreBreakdown
                      breakdown={latest.score_breakdown}
                      criteria={latest.criteria}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="p-5">
                    <h2 className="font-black text-[#256746]">Güçlü yanlar</h2>
                    {latest.strengths.length ? (
                      <ul className="mt-4 space-y-3 text-sm leading-6 text-[#4d586b]">
                        {latest.strengths.map((strength) => (
                          <li key={strength}>• {strength}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-[#818795]">
                        Belirtilmemiş.
                      </p>
                    )}
                  </Card>
                  <Card className="p-5">
                    <h2 className="font-black text-[#9b4b36]">Riskler</h2>
                    {latest.risks.length ? (
                      <ul className="mt-4 space-y-3 text-sm leading-6 text-[#4d586b]">
                        {latest.risks.map((risk) => (
                          <li key={risk}>• {risk}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-[#818795]">
                        Belirtilmemiş.
                      </p>
                    )}
                  </Card>
                </div>
              </>
            ) : (
              <Card className="p-8 text-center">
                <h2 className="text-xl font-black">Değerlendirme bekleniyor</h2>
                <p className="mt-2 text-sm text-[#737b8b]">
                  Agent sonucu oluştuğunda bu alan otomatik dolacak.
                </p>
              </Card>
            )}

            <Card className="p-6">
              <h2 className="text-xl font-black">Değerlendirme geçmişi</h2>
              <div className="mt-5 space-y-3">
                {evaluations.length ? (
                  evaluations.map((evaluation, index) => (
                    <details
                      key={evaluation.id}
                      open={index === 0}
                      className="rounded-2xl border border-[#e1e2de] bg-white p-4"
                    >
                      <summary className="cursor-pointer font-bold">
                        {index === 0 ? "Güncel" : `${index + 1}. sonuç`} ·{" "}
                        {evaluation.final_score.toFixed(2)} ·{" "}
                        {recommendationLabels[evaluation.final_recommendation]}
                        {evaluation.evaluation_origin === "recalculation"
                          ? " · LLM’siz yeniden hesaplama"
                          : " · Agent"}
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-[#555f71]">
                        {evaluation.rationale}
                      </p>
                      <p className="mt-2 text-xs text-[#858b96]">
                        Rubric #{evaluation.rubric_version_id} ·{" "}
                        {evaluation.model} · {evaluation.tool_call_count} araç
                        çağrısı · {formatDate(evaluation.created_at)}
                      </p>
                    </details>
                  ))
                ) : (
                  <p className="text-sm text-[#7d8492]">Henüz sonuç yok.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
