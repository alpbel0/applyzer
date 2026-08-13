import type { AdminApplicationDetail } from "@/lib/db/admin";

type EnrichmentRow = AdminApplicationDetail["enrichment"][number];

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function EnrichmentPanel({ rows }: { rows: EnrichmentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#d9dbdf] p-6 text-sm text-[#78808f]">
        Bu başvuru için enrichment kaydı bulunmuyor.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const url = safeHttpUrl(row.url);
        return (
          <details
            key={row.id}
            className="group rounded-2xl border border-[#e0e1dd] bg-white p-4 open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-[#27324a] capitalize">
                  {row.source}
                </p>
                <p className="mt-1 max-w-2xl truncate text-xs text-[#77808f]">
                  {row.url}
                </p>
              </div>
              <span className="rounded-full bg-[#f1efe7] px-2.5 py-1 text-xs font-bold text-[#615d52]">
                {row.status}
              </span>
            </summary>
            <div className="mt-4 border-t border-[#ecece8] pt-4">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-[#945707] underline underline-offset-4"
                >
                  Kaynağı aç
                </a>
              ) : null}
              {row.error ? (
                <p className="mt-3 rounded-xl bg-[#fff0f0] p-3 text-sm text-[#9d3d3d]">
                  {row.error}
                </p>
              ) : null}
              <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-[#172038] p-4 text-xs leading-5 whitespace-pre-wrap text-[#e9edf6]">
                {JSON.stringify(row.data, null, 2)}
              </pre>
              <p className="mt-2 text-xs text-[#858b96]">
                {new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(row.fetched_at))}
                {row.duration_ms === null ? "" : ` · ${row.duration_ms} ms`}
              </p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
