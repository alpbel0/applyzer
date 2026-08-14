import type { AdminEvaluation, Recommendation } from "@/lib/db/admin";

const recommendationLabels: Record<Recommendation, string> = {
  yes: "Evet",
  maybe: "Belki",
  no: "Hayır",
};

export function RubricComparison({
  evaluations,
}: {
  evaluations: AdminEvaluation[];
}) {
  const versions = Array.from(
    new Map(
      evaluations.map((evaluation) => [
        evaluation.rubric_version_id,
        evaluation,
      ]),
    ).values(),
  ).slice(0, 4);

  if (versions.length < 2) return null;

  const current = versions[0];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs tracking-[0.08em] text-[color:var(--ink-faint)] uppercase">
          <tr>
            <th className="pb-3 font-bold">Rubric</th>
            <th className="pb-3 font-bold">Skor</th>
            <th className="pb-3 font-bold">Fark</th>
            <th className="pb-3 font-bold">Sıra</th>
            <th className="pb-3 font-bold">Öneri</th>
            <th className="pb-3 font-bold">Kaynak</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((evaluation) => {
            const difference = evaluation.final_score - current.final_score;
            return (
              <tr
                key={evaluation.id}
                className="border-t border-[color:var(--line)] text-[color:var(--ink-soft)]"
              >
                <td className="font-data py-3 font-bold text-[color:var(--ink)]">
                  #{evaluation.rubric_version_id}
                  {evaluation.id === current.id ? (
                    <span className="ml-2 text-xs text-[color:var(--good)]">
                      Güncel
                    </span>
                  ) : null}
                </td>
                <td className="font-data py-3 font-bold text-[color:var(--ink)]">
                  {evaluation.final_score.toFixed(2)}
                </td>
                <td className="font-data py-3">
                  {evaluation.id === current.id
                    ? "—"
                    : `${difference > 0 ? "+" : ""}${difference.toFixed(2)}`}
                </td>
                <td className="font-data py-3 font-semibold">
                  {evaluation.rank
                    ? `${evaluation.rank}/${evaluation.ranked_candidate_count}`
                    : "—"}
                </td>
                <td className="py-3">
                  {recommendationLabels[evaluation.final_recommendation]}
                </td>
                <td className="py-3">
                  {evaluation.evaluation_origin === "recalculation"
                    ? "LLM’siz hesaplama"
                    : "Agent"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
