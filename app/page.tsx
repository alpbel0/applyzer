import { ApplicationForm } from "@/components/form/ApplicationForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--paper)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_60rem_40rem_at_20%_0%,black,transparent)] bg-[radial-gradient(circle_at_1px_1px,rgba(20,23,31,0.09)_1px,transparent_0)] bg-[size:22px_22px]" />
        <svg
          className="absolute top-[-60px] right-[-60px] size-[420px] opacity-40"
          viewBox="0 0 200 200"
          fill="none"
        >
          <g stroke="#d98a2b" strokeOpacity="0.3" strokeWidth="1.4">
            <polygon points="100,10 165,47 165,122 100,160 35,122 35,47" />
            <polygon points="100,45 140,68 140,113 100,136 60,113 60,68" />
          </g>
        </svg>
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:px-10 lg:py-14">
        <aside className="lg:sticky lg:top-12 lg:self-start">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--ink)] shadow-lg">
              <svg viewBox="0 0 24 24" className="size-6">
                <polygon
                  points="12,2 20,7 20,17 12,22 4,17 4,7"
                  fill="var(--honey)"
                />
              </svg>
            </div>
            <div>
              <p className="font-display text-sm tracking-[0.16em] text-[color:var(--ink)] uppercase">
                Kovan
              </p>
              <p className="text-xs text-[color:var(--ink-soft)]">
                Startup Studio
              </p>
            </div>
          </div>

          <div className="mt-16 max-w-xl lg:mt-24">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[color:var(--honey-deep)] uppercase">
              <span className="inline-block size-1.5 rotate-45 rounded-[2px] bg-[color:var(--honey)]" />
              AI & Automation Internship
            </p>
            <h1 className="font-display text-[clamp(2.6rem,5.2vw,4.6rem)] leading-[1.04] text-[color:var(--ink)]">
              Merakını
              <span className="block text-[color:var(--honey-deep)]">
                üretime çevir.
              </span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[color:var(--ink-soft)]">
              LLM’ler, agent’lar ve otomasyonla gerçekten bir şeyler kurmaya
              hevesli ekip arkadaşımızı arıyoruz.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {[
              ["Ankara", "Konum"],
              ["Hibrit", "Düzen"],
              ["3 Ay", "Süre"],
              ["Ücretli", "Pozisyon"],
            ].map(([value, label]) => (
              <Badge key={value}>
                <span className="mr-1.5 text-[color:var(--ink)]">
                  {value}
                </span>
                <span className="font-normal text-[color:var(--ink-faint)]">
                  · {label}
                </span>
              </Badge>
            ))}
          </div>

          <div className="mt-10 max-w-md border-l-2 border-[color:var(--honey)] pl-5 text-sm leading-6 text-[color:var(--ink-soft)]">
            <p className="font-semibold text-[color:var(--ink)]">
              Diplomadan çok çalışma biçimine bakıyoruz.
            </p>
            <p className="mt-1">
              Takıldığın yeri, araştırma sürecini ve kurduğun şeyi açıkça
              anlatman yeterli.
            </p>
          </div>
        </aside>

        <div>
          <Card className="p-5 sm:p-8 lg:p-10">
            <div className="mb-10 flex items-start justify-between gap-5">
              <div>
                <p className="mb-2 text-xs font-bold tracking-[0.14em] text-[color:var(--honey-deep)] uppercase">
                  Staj başvurusu
                </p>
                <h2 className="font-display text-3xl text-[color:var(--ink)] sm:text-4xl">
                  Biraz seni tanıyalım.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--ink-soft)]">
                  Form yaklaşık 5 dakika sürer. Yıldızlı alanlar zorunludur.
                </p>
              </div>
              <span className="hidden rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-soft)] sm:inline-flex">
                Tek sayfa
              </span>
            </div>
            <ApplicationForm />
          </Card>

          <footer className="flex flex-col gap-2 px-3 py-8 text-xs text-[color:var(--ink-faint)] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Kovan Startup Studio</p>
            <p>Başvuru deneyimi · Applyzer</p>
          </footer>
        </div>
      </div>
    </main>
  );
}
