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
      <p className="rounded-2xl border border-dashed border-[color:var(--line)] p-6 text-sm text-[color:var(--ink-soft)]">
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
            className="group rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[color:var(--ink)] capitalize">
                  {row.source}
                </p>
                <p className="mt-1 max-w-2xl truncate text-xs text-[color:var(--ink-soft)]">
                  {row.url}
                </p>
              </div>
              <span className="rounded-full bg-[color:var(--paper)] px-2.5 py-1 text-xs font-bold text-[color:var(--ink-soft)]">
                {row.status}
              </span>
            </summary>
            <div className="mt-4 border-t border-[color:var(--line)] pt-4">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-[color:var(--honey-deep)] underline underline-offset-4"
                >
                  Kaynağı aç
                </a>
              ) : null}
              {row.error ? (
                <p className="mt-3 rounded-xl bg-[color:var(--bad-tint)] p-3 text-sm text-[color:var(--bad)]">
                  {row.error}
                </p>
              ) : null}
              <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-[color:var(--ink)] p-4 text-xs leading-5 whitespace-pre-wrap text-[color:var(--paper)]">
                {JSON.stringify(row.data, null, 2)}
              </pre>
              <p className="mt-2 text-xs text-[color:var(--ink-faint)]">
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
