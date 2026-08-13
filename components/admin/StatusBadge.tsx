import type { ApplicationStatus } from "@/lib/db/admin";

const statusStyles: Record<ApplicationStatus, string> = {
  pending: "bg-[#f3f0e7] text-[#6b6251]",
  evaluating: "bg-[#e8eefc] text-[#345b9d]",
  done: "bg-[#e7f4ec] text-[#28704a]",
  failed: "bg-[#fbe9e9] text-[#a33b3b]",
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
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
