import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { Card } from "@/components/ui/Card";
import { isAdminAuthenticated } from "@/lib/auth/admin";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md p-7 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#16213e] text-lg font-black text-[#f0a43a]">
            K
          </div>
          <div>
            <p className="text-sm font-black tracking-[0.16em] uppercase">
              Kovan
            </p>
            <p className="text-xs text-[#737b8b]">Applyzer yönetim paneli</p>
          </div>
        </div>
        <h1 className="mt-9 text-3xl font-black tracking-[-0.035em]">
          Yönetici girişi
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#697184]">
          Aday bilgileri ve değerlendirmeler yalnızca yetkili kullanıcıya
          açıktır.
        </p>
        <AdminLoginForm />
      </Card>
    </main>
  );
}
