import type { ApplicationStatus } from "@/lib/db/admin";

const statusStyles: Record<ApplicationStatus, string> = {
  pending: "bg-[color:var(--paper)] text-[color:var(--ink-soft)]",
  evaluating: "bg-[color:var(--wait-tint)] text-[color:var(--wait)]",
  done: "bg-[color:var(--good-tint)] text-[color:var(--good)]",
  failed: "bg-[color:var(--bad-tint)] text-[color:var(--bad)]",
};

const statusLabels: Record<ApplicationStatus, string> = {
  pending: "Bekliyor",
  evaluating: "Değerlendiriliyor",
  done: "Tamamlandı",
  failed: "Başarısız",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
