"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AdminApplicationRow, Recommendation } from "@/lib/db/admin";

const recommendationLabels: Record<Recommendation, string> = {
  yes: "Evet",
  maybe: "Belki",
  no: "Hayır",
};

const recommendationStyles: Record<Recommendation, string> = {
  yes: "bg-[#dff2e7] text-[#216844]",
  maybe: "bg-[#fff0d6] text-[#9a5b08]",
  no: "bg-[#f8e5e5] text-[#9e3636]",
};

const departmentLabels = {
  match: "Uyumlu",
  related: "İlgili",
  unrelated: "Farklı alan",
} as const;

export function ApplicationTable({ rows }: { rows: AdminApplicationRow[] }) {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<"all" | Recommendation>(
    "all",
  );
  const [sort, setSort] = useState<"newest" | "score_desc" | "score_asc">(
    "newest",
  );

  const hasActiveRows = rows.some(
    (row) => row.status === "pending" || row.status === "evaluating",
  );
  useEffect(() => {
    if (!hasActiveRows) return;
    const interval = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [hasActiveRows, router]);

  const visibleRows = useMemo(() => {
    const filtered = rows.filter(
      (row) =>
        recommendation === "all" || row.final_recommendation === recommendation,
    );
    return filtered.toSorted((left, right) => {
      if (sort === "newest") {
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      }
      const leftScore = left.final_score;
      const rightScore = right.final_score;
      if (leftScore === null) return 1;
      if (rightScore === null) return -1;
      return sort === "score_desc"
        ? rightScore - leftScore
        : leftScore - rightScore;
    });
  }, [recommendation, rows, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-[#e2e3df] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#707887]">
          {visibleRows.length} / {rows.length} başvuru
          {hasActiveRows ? " · Aktif değerlendirmeler 5 sn’de yenileniyor" : ""}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="recommendation-filter">
            Öneri filtresi
          </label>
          <select
            id="recommendation-filter"
            className="form-control py-2 text-sm sm:w-36"
            value={recommendation}
            onChange={(event) =>
              setRecommendation(event.target.value as "all" | Recommendation)
            }
          >
            <option value="all">Tüm öneriler</option>
            <option value="yes">Evet</option>
            <option value="maybe">Belki</option>
            <option value="no">Hayır</option>
          </select>
          <label className="sr-only" htmlFor="application-sort">
            Sıralama
          </label>
          <select
            id="application-sort"
            className="form-control py-2 text-sm sm:w-44"
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="newest">En yeni</option>
            <option value="score_desc">Skor: yüksekten</option>
            <option value="score_asc">Skor: düşükten</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#f7f6f1] text-xs tracking-[0.08em] text-[#747b89] uppercase">
            <tr>
              <th className="px-5 py-3 font-bold">Başvuru</th>
              <th className="px-5 py-3 font-bold">Aday</th>
              <th className="px-5 py-3 font-bold">Skor</th>
              <th className="px-5 py-3 font-bold">Öneri</th>
              <th className="px-5 py-3 font-bold">Bölüm</th>
              <th className="px-5 py-3 font-bold">Durum</th>
              <th className="px-5 py-3 font-bold">Tarih</th>
              <th className="px-5 py-3 text-right font-bold">İncele</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ecece8]">
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="bg-white transition hover:bg-[#fffdf8]"
              >
                <td className="px-5 py-4 font-black text-[#28334b]">
                  <Link href={`/admin/${row.id}`} className="hover:underline">
                    #{row.application_number}
                  </Link>
                </td>
                <td className="min-w-56 px-5 py-4">
                  <Link
                    href={`/admin/${row.id}`}
                    className="font-bold text-[#24304a] hover:underline"
                  >
                    {row.full_name}
                  </Link>
                  <p className="mt-1 max-w-64 truncate text-xs text-[#7a8190]">
                    {row.department_year}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {row.duplicate_number ? (
                      <span className="rounded-full bg-[#eceaf7] px-2 py-0.5 text-[0.68rem] font-bold text-[#64558d]">
                        {row.duplicate_number}. başvuru
                      </span>
                    ) : null}
                    {row.injection_detected ? (
                      <span className="rounded-full bg-[#fee7cf] px-2 py-0.5 text-[0.68rem] font-bold text-[#9b5207]">
                        Güvenlik uyarısı
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-4 text-lg font-black tabular-nums">
                  {row.final_score === null ? "—" : row.final_score.toFixed(2)}
                </td>
                <td className="px-5 py-4">
                  {row.final_recommendation ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${recommendationStyles[row.final_recommendation]}`}
                    >
                      {recommendationLabels[row.final_recommendation]}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-4 text-[#515a6d]">
                  {row.department_fit
                    ? departmentLabels[row.department_fit]
                    : "—"}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-[#626b7c]">
                  {new Intl.DateTimeFormat("tr-TR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(row.created_at))}
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/${row.id}`}
                    aria-label={`${row.full_name} başvurusunun detayını aç`}
                    className="inline-flex items-center rounded-xl border border-[#d7d9df] bg-white px-3 py-2 text-xs font-bold text-[#29354e] transition hover:border-[#16213e] hover:bg-[#16213e] hover:text-white focus-visible:ring-3 focus-visible:ring-[#16213e]/20 focus-visible:outline-none"
                  >
                    Detayı aç →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[#7a8190]">
            Bu filtreyle eşleşen başvuru yok.
          </p>
        ) : null}
      </div>
    </div>
  );
}
