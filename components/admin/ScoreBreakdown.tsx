import type { StoredCriterion, StoredScoreBreakdown } from "@/lib/db/admin";

const criterionLabels: Record<string, string> = {
  rest_api: "REST API / Backend",
  llm_experience: "LLM deneyimi",
  agentic_mcp: "Agentic AI & MCP",
  bonus_tools: "Bonus araçlar",
  verifiability: "Kanıtlanabilirlik",
  learning_signal: "Öğrenme ve iletişim",
  cv_quality: "CV kalitesi",
};

export function ScoreBreakdown({
  breakdown,
  criteria,
}: {
  breakdown: StoredScoreBreakdown[];
  criteria: Record<string, StoredCriterion>;
}) {
  return (
    <div className="space-y-3">
      {breakdown.map((item) => {
        const criterion = criteria[item.key];
        return (
          <article
            key={item.key}
            className="rounded-2xl border border-[#e0e1dd] bg-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-[#27324a]">
                  {criterionLabels[item.key] ?? item.key}
                </p>
                <p className="mt-1 text-xs text-[#7b8290]">
                  Ağırlık %{Math.round(item.weight * 100)} · Katkı{" "}
                  {item.contribution.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-[#16213e] px-3 py-2 text-lg font-black text-white tabular-nums">
                {item.score}/5
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#515a6d]">
              {criterion?.evidence ?? "Kanıt açıklaması bulunamadı."}
            </p>
          </article>
        );
      })}
    </div>
  );
}
