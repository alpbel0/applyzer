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
    <>
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/admin"
          className="text-sm font-bold text-[#85510c] hover:underline"
        >
          ← Başvurulara dön
        </Link>
        <div className="mt-6">
          <p className="text-xs font-bold tracking-[0.18em] text-[#a7620a] uppercase">
            Ayarlar
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">
            Rubric yönetimi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7788]">
            Yalnızca sayısal ağırlıklar değiştirilebilir. Kaydetme yeni sürüm
            oluşturur ve mevcut kriter puanlarını LLM çağırmadan yeniden
            hesaplar.
          </p>
        </div>

        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.9fr]">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black">Aktif ağırlıklar</h2>
              <span className="rounded-full bg-[#e5f2e9] px-3 py-1 text-xs font-bold text-[#296d49]">
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
            <h2 className="text-xl font-black">Sürüm geçmişi</h2>
            <div className="mt-5 space-y-3">
              {history.map((version) => (
                <article
                  key={version.id}
                  className="rounded-2xl border border-[#e0e1dd] bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">Rubric #{version.id}</p>
                    {version.is_active ? (
                      <span className="text-xs font-bold text-[#28704a]">
                        Aktif
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#7a8190]">
                    {new Intl.DateTimeFormat("tr-TR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(version.created_at))}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(version.weights).map(([key, weight]) => (
                      <span
                        key={key}
                        className="rounded-lg bg-[#f4f2eb] px-2 py-1 text-[0.68rem] font-semibold text-[#596174]"
                      >
                        {labels[key] ?? key} %{Math.round(weight * 100)}
                      </span>
                    ))}
                  </div>
                  {version.description ? (
                    <p className="mt-3 text-sm text-[#596174]">
                      {version.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
