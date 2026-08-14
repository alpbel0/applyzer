"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminEmailDraft, Recommendation } from "@/lib/db/admin";

const labels: Record<Recommendation, string> = {
  yes: "Mülakat daveti",
  maybe: "Süreç devam ediyor",
  no: "Olumsuz sonuç",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function EmailDraftPanel({
  draft,
  demoMode,
}: {
  draft: AdminEmailDraft | null;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(draft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!current) {
    return (
      <p className="text-sm leading-6 text-[#7d8492]">
        Bu değerlendirme için henüz mail taslağı bulunmuyor.
      </p>
    );
  }

  async function changeDraftType(draftType: Recommendation) {
    if (!current) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/email/send", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: current.id, draftType }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "Taslak değiştirilemedi.");
      setCurrent((previous) =>
        previous
          ? {
              ...previous,
              ...payload.draft,
              draft_type: payload.draft.draft_type,
            }
          : previous,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Taslak değiştirilemedi.",
      );
    } finally {
      setPending(false);
    }
  }

  async function send() {
    if (!current || current.is_sent) return;
    if (
      !window.confirm(
        demoMode
          ? "Demo modu açık. Mail aday yerine test Gmail hesabına gönderilecek. Devam edilsin mi?"
          : "Mail gerçek aday adresine gönderilecek ve geri alınamaz. Devam edilsin mi?",
      )
    )
      return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: current.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Mail gönderilemedi.");
      setCurrent((previous) =>
        previous
          ? {
              ...previous,
              is_sent: true,
              sent_at: payload.sent_at,
              demo_mode: payload.demo_mode,
              error: null,
            }
          : previous,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Mail gönderilemedi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block text-sm font-bold text-[#3f4960]">
          Taslak tipi
          <select
            value={current.draft_type}
            disabled={pending || current.is_sent}
            onChange={(event) =>
              void changeDraftType(event.target.value as Recommendation)
            }
            className="mt-2 block w-full rounded-xl border border-[#d9dcd8] bg-white px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || current.is_sent}
          onClick={() => void send()}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#16213e] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#263353] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "İşleniyor…"
            : current.is_sent
              ? "Gönderildi"
              : "Maili gönder"}
        </button>
      </div>

      {demoMode && !current.is_sent ? (
        <p className="mt-4 rounded-xl bg-[#fff3df] px-4 py-3 text-xs font-semibold text-[#87520b]">
          Demo modu açık: gerçek aday adresi yerine test Gmail hesabı
          kullanılacak.
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-[#e1e2de] bg-[#fbfbf8] p-5">
        <p className="text-xs font-bold tracking-[0.08em] text-[#858b97] uppercase">
          Konu
        </p>
        <p className="mt-2 font-bold text-[#16213e]">{current.subject}</p>
        <div className="my-4 h-px bg-[#e1e2de]" />
        <p className="text-xs font-bold tracking-[0.08em] text-[#858b97] uppercase">
          İçerik
        </p>
        <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[#3f4960]">
          {current.body}
        </p>
      </div>

      {current.is_sent && current.sent_at ? (
        <p className="mt-4 text-sm font-bold text-[#2d7652]">
          Gönderildi{current.demo_mode ? " (demo)" : ""} ·{" "}
          {formatDate(current.sent_at)}
        </p>
      ) : null}
      {current.error ? (
        <p className="mt-3 text-sm font-semibold text-[#ad3d3d]">
          Son hata: {current.error}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#ad3d3d]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
