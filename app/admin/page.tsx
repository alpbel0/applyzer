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
    <div className="min-h-screen bg-[color:var(--paper)]">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-[color:var(--honey-deep)] uppercase">
              Yönetim
            </p>
            <h1 className="font-display mt-2 text-4xl text-[color:var(--ink)]">
              Başvurular
            </h1>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Adayları karşılaştır, değerlendirmeleri ve kaynakları incele.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Aktif", active, "var(--wait)"],
              ["Tamam", completed, "var(--good)"],
              ["Başarısız", failed, "var(--bad)"],
            ].map(([label, value, color]) => (
              <div
                key={label as string}
                className="min-w-24 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3"
              >
                <p
                  className="font-data text-xl font-bold"
                  style={{ color: color as string }}
                >
                  {value}
                </p>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Card className="mt-8 overflow-hidden p-0">
          <ApplicationTable rows={applications} />
        </Card>
      </main>
    </div>
  );
}
