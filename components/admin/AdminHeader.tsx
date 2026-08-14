import Link from "next/link";

import { logoutAction } from "@/app/admin/login/actions";

export function AdminHeader() {
  return (
    <header className="border-b border-[color:var(--line)] bg-[color:var(--ink)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--honey)]">
            <svg viewBox="0 0 24 24" className="size-5">
              <polygon
                points="12,2 20,7 20,17 12,22 4,17 4,7"
                fill="var(--ink)"
              />
            </svg>
          </span>
          <span>
            <span className="font-display block text-sm tracking-[0.1em] text-[color:var(--paper)] uppercase">
              Applyzer
            </span>
            <span className="block text-xs text-[color:var(--paper)]/55">
              Yönetim paneli
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/rubric"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[color:var(--paper)]/80 hover:bg-white/10"
          >
            Rubric
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-semibold text-[color:var(--paper)]/80 transition hover:border-white/30 hover:bg-white/10"
            >
              Çıkış yap
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
