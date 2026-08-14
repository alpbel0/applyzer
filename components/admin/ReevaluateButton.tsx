"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ReevaluateButton({
  applicationId,
  evaluating,
}: {
  applicationId: string;
  evaluating: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!evaluating) return;
    const interval = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [evaluating, router]);

  async function reevaluate() {
    if (
      !window.confirm(
        "Bu işlem PDF’i ve mevcut enrichment verisini aynı değerlendirme promptuyla tekrar agent’a gönderir. OpenRouter maliyeti oluşur; GitHub yeniden çekilmez. Devam edilsin mi?",
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/applications/${applicationId}/reevaluate`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Başlatılamadı.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Başlatılamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending || evaluating}
        onClick={reevaluate}
        className="inline-flex w-full items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3 text-sm font-bold text-[color:var(--ink)] transition hover:border-[color:var(--honey)] hover:bg-[color:var(--honey-tint)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending || evaluating ? "Değerlendiriliyor…" : "↻ Yeniden değerlendir"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-[color:var(--bad)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
