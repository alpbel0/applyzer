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
        const pct = Math.round((item.score / 5) * 100);
        return (
          <article
            key={item.key}
            className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[color:var(--ink)]">
                  {criterionLabels[item.key] ?? item.key}
                </p>
                <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
                  Ağırlık %{Math.round(item.weight * 100)} · Katkı{" "}
                  {item.contribution.toFixed(2)}
                </p>
              </div>
              <div className="font-data rounded-xl bg-[color:var(--ink)] px-3 py-2 text-lg font-bold text-[color:var(--paper)]">
                {item.score}/5
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--line)]">
              <div
                className="h-full rounded-full bg-[color:var(--honey)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-[color:var(--ink-soft)]">
              {criterion?.evidence ?? "Kanıt açıklaması bulunamadı."}
            </p>
          </article>
        );
      })}
    </div>
  );
}
