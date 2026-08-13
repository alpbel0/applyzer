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
        <thead className="text-xs tracking-[0.08em] text-[#818795] uppercase">
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
                className="border-t border-[#e8e7e1] text-[#4f596c]"
              >
                <td className="py-3 font-black text-[#16213e]">
                  #{evaluation.rubric_version_id}
                  {evaluation.id === current.id ? (
                    <span className="ml-2 text-xs text-[#26704a]">Güncel</span>
                  ) : null}
                </td>
                <td className="py-3 font-black tabular-nums">
                  {evaluation.final_score.toFixed(2)}
                </td>
                <td className="py-3 tabular-nums">
                  {evaluation.id === current.id
                    ? "—"
                    : `${difference > 0 ? "+" : ""}${difference.toFixed(2)}`}
                </td>
                <td className="py-3 font-semibold tabular-nums">
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
