import Link from "next/link";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { WeightSliders } from "@/components/admin/WeightSliders";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth/admin";
import {
  countEvaluatedApplications,
  getActiveRubric,
  getRubricHistory,
} from "@/lib/db/rubric";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  rest_api: "REST API",
  llm_experience: "LLM",
  agentic_mcp: "Agentic/MCP",
  bonus_tools: "Bonus",
  verifiability: "Kanıt",
  learning_signal: "Öğrenme",
  cv_quality: "CV",
};

export default async function RubricPage() {
  await requireAdmin();
  const [active, history, candidateCount] = await Promise.all([
    getActiveRubric(),
    getRubricHistory(),
    countEvaluatedApplications(),
  ]);

  return (
    <div className="min-h-screen bg-[color:var(--paper)]">
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/admin"
          className="text-sm font-bold text-[color:var(--honey-deep)] hover:underline"
        >
          ← Başvurulara dön
        </Link>
        <div className="mt-6">
          <p className="text-xs font-bold tracking-[0.14em] text-[color:var(--honey-deep)] uppercase">
            Ayarlar
          </p>
          <h1 className="font-display mt-2 text-4xl text-[color:var(--ink)]">
            Rubric yönetimi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--ink-soft)]">
            Yalnızca sayısal ağırlıklar değiştirilebilir. Kaydetme yeni sürüm
            oluşturur ve mevcut kriter puanlarını LLM çağırmadan yeniden
            hesaplar.
          </p>
        </div>

        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.9fr]">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl text-[color:var(--ink)]">
                Aktif ağırlıklar
              </h2>
              <span className="rounded-full bg-[color:var(--good-tint)] px-3 py-1 text-xs font-bold text-[color:var(--good)]">
                Sürüm #{active.id}
              </span>
            </div>
            <div className="mt-7">
              <WeightSliders
                initialWeights={active.weights}
                candidateCount={candidateCount}
              />
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <h2 className="font-display text-xl text-[color:var(--ink)]">
              Sürüm geçmişi
            </h2>
            <div className="mt-5 space-y-3">
              {history.map((version) => (
                <article
                  key={version.id}
                  className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-[color:var(--ink)]">
                      Rubric #{version.id}
                    </p>
                    {version.is_active ? (
                      <span className="text-xs font-bold text-[color:var(--good)]">
                        Aktif
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--ink-faint)]">
                    {new Intl.DateTimeFormat("tr-TR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(version.created_at))}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(version.weights).map(([key, weight]) => (
                      <span
                        key={key}
                        className="font-data rounded-lg bg-[color:var(--paper)] px-2 py-1 text-[0.68rem] font-semibold text-[color:var(--ink-soft)]"
                      >
                        {labels[key] ?? key} %{Math.round(weight * 100)}
                      </span>
                    ))}
                  </div>
                  {version.description ? (
                    <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
                      {version.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
