import { ApplicationForm } from "@/components/form/ApplicationForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-28 size-96 rounded-full bg-[#f1aa43]/18 blur-3xl" />
        <div className="absolute top-[35rem] -right-40 size-[32rem] rounded-full bg-[#94a3c7]/16 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(22,33,62,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(22,33,62,0.035)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_75%)] bg-[size:48px_48px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:px-10 lg:py-14">
        <aside className="lg:sticky lg:top-12 lg:self-start">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#16213e] text-lg font-black text-[#f0a43a] shadow-lg">
              K
            </div>
            <div>
              <p className="text-sm font-black tracking-[0.16em] text-[#16213e] uppercase">
                Kovan
              </p>
              <p className="text-xs text-[#6f7788]">Startup Studio</p>
            </div>
          </div>

          <div className="mt-16 max-w-xl lg:mt-24">
            <p className="mb-5 text-xs font-bold tracking-[0.22em] text-[#ae680d] uppercase">
              AI & Automation Internship
            </p>
            <h1 className="text-[clamp(2.9rem,6vw,5.6rem)] leading-[0.94] font-black tracking-[-0.055em] text-[#16213e]">
              Merakını
              <span className="block text-[#d78216]">üretime çevir.</span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#596174]">
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
                <span className="mr-1.5 text-[#b46b09]">{value}</span>
                <span className="font-normal text-[#818797]">· {label}</span>
              </Badge>
            ))}
          </div>

          <div className="mt-10 max-w-md border-l-2 border-[#e4a13f] pl-5 text-sm leading-6 text-[#687082]">
            <p className="font-semibold text-[#354057]">
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
                <p className="mb-2 text-xs font-bold tracking-[0.18em] text-[#b46b09] uppercase">
                  Staj başvurusu
                </p>
                <h2 className="text-3xl font-black tracking-[-0.035em] text-[#16213e] sm:text-4xl">
                  Biraz seni tanıyalım.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#6a7283]">
                  Form yaklaşık 5 dakika sürer. Yıldızlı alanlar zorunludur.
                </p>
              </div>
              <span className="hidden rounded-full bg-[#f5f2e9] px-3 py-1.5 text-xs font-semibold text-[#697184] sm:inline-flex">
                Tek sayfa
              </span>
            </div>
            <ApplicationForm />
          </Card>

          <footer className="flex flex-col gap-2 px-3 py-8 text-xs text-[#7a8190] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Kovan Startup Studio</p>
            <p>Başvuru deneyimi · Applyzer</p>
          </footer>
        </div>
      </div>
    </main>
  );
}
