import Link from "next/link";

import { Card } from "@/components/ui/Card";

export default async function ThankYouPage({
  searchParams,
}: PageProps<"/tesekkurler">) {
  const { application_number: rawApplicationNumber } = await searchParams;
  const applicationNumber =
    typeof rawApplicationNumber === "string" &&
    /^\d+$/u.test(rawApplicationNumber)
      ? rawApplicationNumber
      : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <div
        aria-hidden="true"
        className="absolute -top-40 -left-32 size-[30rem] rounded-full bg-[#f1aa43]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-40 -bottom-52 size-[34rem] rounded-full bg-[#8d9fc7]/18 blur-3xl"
      />
      <Card className="relative w-full max-w-xl p-7 text-center sm:p-12">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#16213e] text-[#f0a43a] shadow-[0_18px_40px_rgba(22,33,62,0.2)]">
          <svg
            viewBox="0 0 24 24"
            className="size-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <p className="mt-8 text-xs font-bold tracking-[0.2em] text-[#af680c] uppercase">
          Başvurun alındı
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#16213e]">
          Teşekkürler.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[#626b7d]">
          Bilgilerin bize ulaştı. Başvurunu inceleyip süreçle ilgili seninle
          e-posta üzerinden iletişime geçeceğiz.
        </p>

        {applicationNumber ? (
          <div className="mx-auto mt-8 max-w-xs rounded-2xl border border-[#e4dfd2] bg-[#fbfaf6] p-5">
            <p className="text-xs font-semibold tracking-wide text-[#777f8f] uppercase">
              Başvuru numaran
            </p>
            <p className="mt-1 text-3xl font-black text-[#16213e] tabular-nums">
              #{applicationNumber}
            </p>
            <p className="mt-2 text-xs text-[#858b98]">
              Bu numarayı not alabilirsin.
            </p>
          </div>
        ) : null}

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d2d4da] bg-white px-5 text-sm font-semibold text-[#273149] transition hover:border-[#16213e] hover:bg-[#f8f7f2] focus-visible:ring-2 focus-visible:ring-[#16213e] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Ana sayfaya dön
        </Link>
        <p className="mt-8 text-xs text-[#9095a0]">
          Değerlendirme sonuçları aday ekranında gösterilmez.
        </p>
      </Card>
    </main>
  );
}
