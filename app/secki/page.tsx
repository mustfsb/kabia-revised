import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import { ProducerCard } from "@/components/producers/producer-card"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchSeckiProducers, type Producer } from "@/lib/producers"
import { producerCollections } from "@/content/producers"
import { isBrandPreview } from "@/lib/brand-preview"

export const metadata: Metadata = {
  title: "Seçki",
  description:
    "Kendi çiftliğimizin ötesinde: üretim anlayışına güvendiğimiz, tanıdığımız küçük üreticiler.",
  alternates: { canonical: "/secki" },
}

type SeckiProducer = Omit<Producer, "createdAt" | "tagline" | "sortOrder"> & {
  desc?: string
  tagline?: string | null
}

/**
 * Which four producers appear is an operational decision now: published
 * producers on the Seçki line, in curated order. The explicit content array
 * below survives only behind the preview gate, the same way /ureticiler
 * keeps its fixture branch.
 */
function SeckiGrid({ producers }: { producers: readonly SeckiProducer[] }) {
  return (
    <PageShell>
      <section aria-labelledby="secki-heading">
        <div className="wrap page-top pb-16 md:pb-24">
          <p className="label text-olive">Seçki</p>
          <h1
            id="secki-heading"
            className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
          >
            Tanıdığımız <em className="font-theme-display italic text-brand">üreticiler</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Her ürünü biz üretmiyoruz. Üreticisini tanır, üretim yerini görür,
            nasıl yapıldığını sorarız — sonra seçeriz.
          </p>
        </div>

        <div className="wrap">
          {producers.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-theme-display text-2xl italic text-ink/70">
                Şu anda Seçki&apos;de yayında bir üretici yok.
              </p>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
                Üreticiler yayına alındıkça burada listelenir.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
              {producers.map((producer, i) => (
                <ProducerCard
                  key={producer.id}
                  producer={producer}
                  priority={i < 3}
                  variant="secki"
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  )
}

/**
 * A failed read is not an empty shelf. An outage must never render as "no
 * producers yet" — the same distinction /ureticiler draws, in this page's
 * own heading.
 */
function SeckiOutage() {
  return (
    <PageShell>
      <section aria-labelledby="secki-heading">
        <div className="wrap page-top pb-16 md:pb-24">
          <p className="label text-olive">Seçki</p>
          <h1
            id="secki-heading"
            className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
          >
            Tanıdığımız <em className="font-theme-display italic text-brand">üreticiler</em>.
          </h1>
        </div>

        <div role="alert" className="wrap flex flex-col items-start pb-24 md:pb-32">
          <p className="font-theme-display text-3xl italic text-clay">
            Seçki şu anda yüklenemiyor.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
            Lütfen daha sonra yeniden deneyin.
          </p>
        </div>
      </section>
    </PageShell>
  )
}

export default async function SeckiPage() {
  if (isBrandPreview()) return <SeckiGrid producers={producerCollections.secki} />

  const result = await fetchSeckiProducers(await createSupabaseServerClient())
  if (result.status === "error") return <SeckiOutage />

  return <SeckiGrid producers={result.producers} />
}
