import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { DetailTabs } from "@/components/admin/DetailTabs";
import { EnrichmentPanel } from "@/components/admin/EnrichmentPanel";
import { EmailDraftPanel } from "@/components/admin/EmailDraftPanel";
import { ScoreBreakdown } from "@/components/admin/ScoreBreakdown";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ReevaluateButton } from "@/components/admin/ReevaluateButton";
import { RubricComparison } from "@/components/admin/RubricComparison";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAdminApplicationDetail,
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
      <p className="text-xs font-bold tracking-[0.08em] text-[color:var(--ink-faint)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[color:var(--ink)]">
        {value?.trim() || "Belirtilmemiş"}
      </p>
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

  const { application, evaluations, emails, enrichment } = detail;
  const latest = evaluations[0];
  const emailDraft = latest
    ? (emails.find((email) => email.evaluation_id === latest.id) ??
      emails[0] ??
      null)
    : null;
  const demoMode = process.env.DEMO_MODE?.trim().toLowerCase() !== "false";

  const rail = (
    <>
      {latest ? (
        <div className="rounded-2xl bg-[color:var(--ink)] p-5 text-[color:var(--paper)]">
          <p className="text-xs text-[color:var(--paper)]/55">Nihai skor</p>
          <p className="font-data mt-1 text-4xl font-bold">
            {latest.final_score.toFixed(2)}
          </p>
          <div className="mt-4 flex gap-4 border-t border-white/10 pt-4">
            <div className="flex-1">
              <p className="text-[0.65rem] text-[color:var(--paper)]/45">
                Model önerisi
              </p>
              <p className="mt-1 text-sm font-bold">
                {recommendationLabels[latest.model_recommendation]}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-[0.65rem] text-[color:var(--paper)]/45">
                Nihai öneri
              </p>
              <p className="mt-1 text-sm font-bold text-[color:var(--honey)]">
                {recommendationLabels[latest.final_recommendation]}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-5 text-center">
          <p className="font-bold text-[color:var(--ink)]">
            Değerlendirme bekleniyor
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
            Agent sonucu oluştuğunda burası dolacak.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <ReevaluateButton
          applicationId={application.id}
          evaluating={application.status === "evaluating"}
        />
        <a
          href={`/api/cv/${application.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[color:var(--ink)] px-5 text-sm font-bold text-[color:var(--paper)] transition hover:bg-[#0b0d13]"
        >
          CV’yi aç · 5 dk
        </a>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.08em] text-[color:var(--ink-faint)] uppercase">
            Bölüm / sınıf
          </p>
          <p className="mt-1 text-sm text-[color:var(--ink)]">
            {application.department_year}
          </p>
        </div>
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.08em] text-[color:var(--ink-faint)] uppercase">
            Ofise gelebileceği gün
          </p>
          <p className="mt-1 text-sm text-[color:var(--ink)]">
            {officeLabels[application.office_days_per_week] ??
              application.office_days_per_week}
          </p>
        </div>
        {application.links ? (
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.08em] text-[color:var(--ink-faint)] uppercase">
              Bağlantılar
            </p>
            <p className="mt-1 truncate text-sm text-[color:var(--ink)]">
              {application.links}
            </p>
          </div>
        ) : null}
      </Card>
    </>
  );

  const overviewTab = latest ? (
    <>
      <Card className="p-6">
        <h2 className="font-display text-lg text-[color:var(--ink)]">
          Kriter kırılımı
        </h2>
        <div className="mt-5">
          <ScoreBreakdown
            breakdown={latest.score_breakdown}
            criteria={latest.criteria}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg text-[color:var(--ink)]">
          Karar özeti
        </h2>
        <div className="mt-5 space-y-5">
          <TextBlock label="Gerekçe" value={latest.rationale} />
          <TextBlock label="CV özeti" value={latest.cv_summary} />
          <TextBlock label="Konum yorumu" value={latest.location_note} />
          <TextBlock
            label="Bölüm uyumu"
            value={departmentLabels[latest.department_fit]}
          />
        </div>
        {latest.override_reason ? (
          <div className="mt-5 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] p-4 text-sm leading-6 text-[color:var(--ink-soft)]">
            <strong className="text-[color:var(--ink)]">
              Sistem override:
            </strong>{" "}
            {latest.override_reason}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold text-[color:var(--good)]">Güçlü yanlar</h2>
          {latest.strengths.length ? (
            <ul className="mt-4 space-y-2.5 text-sm leading-6 text-[color:var(--ink)]">
              {latest.strengths.map((strength) => (
                <li key={strength} className="relative pl-3.5">
                  <span className="absolute top-2 left-0 size-1.5 rotate-45 rounded-[2px] bg-[color:var(--good)]" />
                  {strength}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--ink-faint)]">
              Belirtilmemiş.
            </p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-[color:var(--bad)]">Riskler</h2>
          {latest.risks.length ? (
            <ul className="mt-4 space-y-2.5 text-sm leading-6 text-[color:var(--ink)]">
              {latest.risks.map((risk) => (
                <li key={risk} className="relative pl-3.5">
                  <span className="absolute top-2 left-0 size-1.5 rotate-45 rounded-[2px] bg-[color:var(--bad)]" />
                  {risk}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--ink-faint)]">
              Belirtilmemiş.
            </p>
          )}
        </Card>
      </div>

      {evaluations.length > 1 ? (
        <Card className="p-6">
          <h2 className="font-display text-lg text-[color:var(--ink)]">
            Rubric karşılaştırması
          </h2>
          <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
            Aynı kriter puanlarının farklı rubric sürümlerindeki sonucu.
          </p>
          <div className="mt-5">
            <RubricComparison evaluations={evaluations} />
          </div>
        </Card>
      ) : null}
    </>
  ) : (
    <Card className="p-8 text-center">
      <h2 className="font-display text-lg text-[color:var(--ink)]">
        Değerlendirme bekleniyor
      </h2>
      <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
        Agent sonucu oluştuğunda bu alan otomatik dolacak.
      </p>
    </Card>
  );

  const formTab = (
    <Card className="space-y-6 p-6">
      <TextBlock label="Teknolojiler" value={application.technologies} />
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
        label="Konum ve çalışma düzeni notu"
        value={application.location_note}
      />
      <TextBlock label="CV dosyası" value={application.cv_file_name} />
      <TextBlock
        label="Veri işleme onayı"
        value={formatDate(application.consent_at)}
      />
    </Card>
  );

  const enrichTab = (
    <Card className="p-6">
      <h2 className="font-display text-lg text-[color:var(--ink)]">
        Enrichment kaynakları
      </h2>
      <div className="mt-5">
        <EnrichmentPanel rows={enrichment} />
      </div>
    </Card>
  );

  const emailTab = (
    <Card className="p-6">
      <h2 className="font-display text-lg text-[color:var(--ink)]">
        Aday maili
      </h2>
      <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
        Göndermeden önce taslağı ve türünü kontrol edin.
      </p>
      <div className="mt-5">
        <EmailDraftPanel draft={emailDraft} demoMode={demoMode} />
      </div>
    </Card>
  );

  const historyTab = (
    <Card className="p-6">
      <div className="space-y-3">
        {evaluations.length ? (
          evaluations.map((evaluation, index) => (
            <details
              key={evaluation.id}
              open={index === 0}
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-4"
            >
              <summary className="cursor-pointer font-bold text-[color:var(--ink)]">
                {index === 0 ? "Güncel" : `${index + 1}. sonuç`} ·{" "}
                {evaluation.final_score.toFixed(2)} ·{" "}
                {recommendationLabels[evaluation.final_recommendation]}
                {evaluation.evaluation_origin === "recalculation"
                  ? " · LLM’siz yeniden hesaplama"
                  : " · Agent"}
              </summary>
              <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
                {evaluation.rationale}
              </p>
              <p className="mt-2 text-xs text-[color:var(--ink-faint)]">
                Rubric #{evaluation.rubric_version_id} · {evaluation.model} ·{" "}
                {evaluation.tool_call_count} araç çağrısı ·{" "}
                {formatDate(evaluation.created_at)}
              </p>
            </details>
          ))
        ) : (
          <p className="text-sm text-[color:var(--ink-soft)]">
            Henüz sonuç yok.
          </p>
        )}
      </div>
    </Card>
  );

  const tabs = [
    { id: "overview", label: "Genel bakış", content: overviewTab },
    { id: "form", label: "Form bilgileri", content: formTab },
    {
      id: "enrichment",
      label: "Zenginleştirme",
      badge: enrichment.length,
      content: enrichTab,
    },
    { id: "email", label: "Aday maili", content: emailTab },
    {
      id: "history",
      label: "Geçmiş",
      badge: evaluations.length,
      content: historyTab,
    },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--paper)]">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/admin"
          className="text-sm font-bold text-[color:var(--honey-deep)] hover:underline"
        >
          ← Başvurulara dön
        </Link>

        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-data text-sm font-bold text-[color:var(--honey-deep)]">
              #{application.application_number}
            </span>
            <StatusBadge status={application.status} />
          </div>
          <h1 className="font-display mt-3 text-4xl text-[color:var(--ink)] sm:text-5xl">
            {application.full_name}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
            {application.email} · {formatDate(application.created_at)}
          </p>
        </div>

        {application.error_message ? (
          <div className="mt-7 rounded-2xl border border-[color:var(--bad)]/30 bg-[color:var(--bad-tint)] p-4 text-sm font-semibold text-[color:var(--bad)]">
            İşlem hatası: {application.error_message}
          </div>
        ) : null}

        {latest?.injection_detected ? (
          <div
            role="alert"
            className="mt-7 rounded-2xl border-2 border-[color:var(--wait)]/40 bg-[color:var(--wait-tint)] p-5"
          >
            <p className="font-bold text-[color:var(--wait)]">
              Prompt injection şüphesi
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--wait)]">
              Aday girdisinde değerlendirme talimatlarını etkilemeye yönelik
              bir sinyal tespit edildi. Bu uyarı puanı veya öneriyi otomatik
              olarak değiştirmez.
            </p>
            {latest.injection_note ? (
              <p className="mt-2 text-sm font-semibold text-[color:var(--wait)]">
                {latest.injection_note}
              </p>
            ) : null}
          </div>
        ) : null}

        <DetailTabs rail={rail} tabs={tabs} />
      </main>
    </div>
  );
}
