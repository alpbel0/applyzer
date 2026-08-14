import Link from "next/link";

import { Card } from "@/components/ui/Card";

export default function ThankYouPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[color:var(--paper)] px-5 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_50rem_36rem_at_50%_20%,black,transparent)] bg-[radial-gradient(circle_at_1px_1px,rgba(20,23,31,0.09)_1px,transparent_0)] bg-[size:22px_22px]"
      />
      <Card className="relative w-full max-w-xl p-7 text-center sm:p-12">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[color:var(--ink)]">
          <svg
            viewBox="0 0 24 24"
            className="size-8"
            fill="none"
            stroke="var(--honey)"
            strokeWidth="2"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <p className="mt-8 text-xs font-bold tracking-[0.18em] text-[color:var(--honey-deep)] uppercase">
          Başvurun alındı
        </p>
        <h1 className="font-display mt-3 text-4xl text-[color:var(--ink)]">
          Başvurun için teşekkürler.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[color:var(--ink-soft)]">
          Başvurunu değerlendirdikten sonra seninle e-posta üzerinden
          iletişime geçeceğiz.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-sm font-semibold text-[color:var(--ink)] transition hover:border-[color:var(--ink)] hover:bg-[color:var(--paper)] focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Ana sayfaya dön
        </Link>
        <p className="mt-8 text-xs text-[color:var(--ink-faint)]">
          Değerlendirme sonuçları aday ekranında gösterilmez.
        </p>
      </Card>
    </main>
  );
}
