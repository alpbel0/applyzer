import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { Card } from "@/components/ui/Card";
import { isAdminAuthenticated } from "@/lib/auth/admin";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--paper)] px-5 py-12">
      <Card className="w-full max-w-md p-7 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--ink)]">
            <svg viewBox="0 0 24 24" className="size-6">
              <polygon
                points="12,2 20,7 20,17 12,22 4,17 4,7"
                fill="var(--honey)"
              />
            </svg>
          </div>
          <div>
            <p className="font-display text-sm tracking-[0.14em] text-[color:var(--ink)] uppercase">
              Kovan
            </p>
            <p className="text-xs text-[color:var(--ink-soft)]">
              Applyzer yönetim paneli
            </p>
          </div>
        </div>
        <h1 className="font-display mt-9 text-3xl text-[color:var(--ink)]">
          Yönetici girişi
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">
          Aday bilgileri ve değerlendirmeler yalnızca yetkili kullanıcıya
          açıktır.
        </p>
        <AdminLoginForm />
      </Card>
    </main>
  );
}
