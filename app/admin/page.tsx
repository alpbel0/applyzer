import { AdminHeader } from "@/components/admin/AdminHeader";
import { ApplicationTable } from "@/components/admin/ApplicationTable";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminApplications } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const applications = await getAdminApplications();
  const active = applications.filter(
    (item) => item.status === "pending" || item.status === "evaluating",
  ).length;
  const completed = applications.filter(
    (item) => item.status === "done",
  ).length;
  const failed = applications.filter((item) => item.status === "failed").length;

  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#a7620a] uppercase">
              Yönetim
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">
              Başvurular
            </h1>
            <p className="mt-2 text-sm text-[#6f7788]">
              Adayları karşılaştır, değerlendirmeleri ve kaynakları incele.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Aktif", active],
              ["Tamam", completed],
              ["Başarısız", failed],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-24 rounded-2xl border border-[#dedfdc] bg-white px-4 py-3"
              >
                <p className="text-xl font-black">{value}</p>
                <p className="text-xs text-[#7a8190]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="mt-8 overflow-hidden p-0">
          <ApplicationTable rows={applications} />
        </Card>
      </main>
    </>
  );
}
