import Link from "next/link";

import { logoutAction } from "@/app/admin/login/actions";

export function AdminHeader() {
  return (
    <header className="border-b border-[#dedfdc] bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#16213e] font-black text-[#f0a43a]">
            K
          </span>
          <span>
            <span className="block text-sm font-black tracking-[0.12em] uppercase">
              Applyzer
            </span>
            <span className="block text-xs text-[#7a8190]">Yönetim paneli</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/rubric"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[#3a4358] hover:bg-[#f2f0e9]"
          >
            Rubric
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-xl border border-[#d8dae0] bg-white px-4 py-2 text-sm font-semibold text-[#3a4358] transition hover:border-[#b8bdc8] hover:bg-[#f8f7f3]"
            >
              Çıkış yap
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
