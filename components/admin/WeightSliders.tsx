"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { RubricWeights } from "@/lib/evaluation/score";
import type { CriterionKey } from "@/lib/schemas/evaluation";

const labels: Record<CriterionKey, string> = {
  rest_api: "REST API / Backend",
  llm_experience: "LLM deneyimi",
  agentic_mcp: "Agentic AI & MCP",
  bonus_tools: "Bonus araçlar",
  verifiability: "Kanıtlanabilirlik",
  learning_signal: "Öğrenme ve iletişim",
  cv_quality: "CV kalitesi",
};

export function WeightSliders({
  initialWeights,
  candidateCount,
}: {
  initialWeights: RubricWeights;
  candidateCount: number;
}) {
  const router = useRouter();
  const [weights, setWeights] = useState<Record<CriterionKey, number>>(
    Object.fromEntries(
      Object.entries(initialWeights).map(([key, value]) => [key, value * 100]),
    ) as Record<CriterionKey, number>,
  );
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const total = useMemo(
    () => Object.values(weights).reduce((sum, value) => sum + value, 0),
    [weights],
  );

  async function save() {
    if (total !== 100 || pending) return;
    if (
      !window.confirm(
        `Yeni rubric sürümü oluşturulacak ve ${candidateCount} aday LLM çağrılmadan yeniden hesaplanacak. Devam edilsin mi?`,
      )
    )
      return;

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weights: Object.fromEntries(
            Object.entries(weights).map(([key, value]) => [key, value / 100]),
          ),
          description: description.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Kaydedilemedi.");
      setMessage(
        `Rubric #${payload.rubric_version_id} oluşturuldu; ${payload.recalculated_count} aday güncellendi.`,
      );
      setDescription("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {(Object.keys(labels) as CriterionKey[]).map((key) => (
        <div key={key}>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label htmlFor={`weight-${key}`} className="text-sm font-bold">
              {labels[key]}
            </label>
            <span className="font-data rounded-lg bg-[color:var(--paper)] px-2.5 py-1 text-sm font-bold text-[color:var(--ink)]">
              %{weights[key]}
            </span>
          </div>
          <input
            id={`weight-${key}`}
            type="range"
            min="0"
            max="100"
            step="1"
            value={weights[key]}
            onChange={(event) =>
              setWeights((current) => ({
                ...current,
                [key]: Number(event.target.value),
              }))
            }
            className="w-full accent-[color:var(--honey)]"
          />
        </div>
      ))}

      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[color:var(--ink)]">Toplam</span>
          <span
            className={`font-data font-bold ${
              total === 100
                ? "text-[color:var(--good)]"
                : "text-[color:var(--bad)]"
            }`}
          >
            %{total}
          </span>
        </div>
        {total !== 100 ? (
          <p className="mt-2 text-xs font-semibold text-[color:var(--bad)]">
            Kaydetmek için toplam tam %100 olmalıdır.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="rubric-description" className="form-label">
          Sürüm notu <span className="form-optional">Opsiyonel</span>
        </label>
        <input
          id="rubric-description"
          className="form-control"
          maxLength={160}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Örn. MCP ağırlığı artırıldı"
        />
      </div>

      {message ? (
        <p
          role="status"
          className="text-sm font-semibold text-[color:var(--ink)]"
        >
          {message}
        </p>
      ) : null}
      <Button type="button" disabled={pending || total !== 100} onClick={save}>
        {pending ? "Kaydediliyor…" : "Yeni sürümü kaydet"}
      </Button>
    </div>
  );
}
