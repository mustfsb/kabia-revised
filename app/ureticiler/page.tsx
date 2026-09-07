import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import { ProducerCard } from "@/components/producers/producer-card"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchPublicProducers, type Producer } from "@/lib/producers"
import { sourceProducers } from "@/content/producers"
import { isBrandPreview } from "@/lib/brand-preview"

export const metadata: Metadata = {
  title: "Üreticiler",
  description: "Kabia'nın ürünlerini bir araya getirdiği, güvendiği küçük üreticiler.",
  alternates: { canonical: "/ureticiler" },
}

type GridProducer = Omit<Producer, "createdAt" | "tagline" | "sortOrder"> & {
  desc?: string
  tagline?: string | null
}

/** The page heading, shared by every state so the page reads the same either way. */
function Heading() {
  return (
    <div className="wrap page-top pb-16 md:pb-24">
      <p className="label text-olive">Seçki</p>
      <h1 id="producers-heading" className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
        <em className="font-theme-display italic text-brand">Üreticiler</em>.
      </h1>
      <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
        Kendi çiftliğimizin sınırlarının ötesine geçiyoruz. Kabia yalnızca kendi ürettiklerini değil, üretim
        anlayışına güvendiği küçük üreticilerin ürünlerini de bir araya getirir.
      </p>
    </div>
  )
}

function ProducersGrid({ producers }: { producers: readonly GridProducer[] }) {
  return (
    <PageShell>
      <section aria-labelledby="producers-heading">
        <Heading />

        <div className="wrap">
          {producers.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-theme-display text-2xl italic text-ink/70">
                Şu anda yayında bir üretici profili yok.
              </p>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
                Üretici profilleri eklendikçe burada listelenir.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
              {producers.map((producer, i) => (
                <ProducerCard key={producer.id} producer={producer} priority={i < 3} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  )
}

/**
 * A failed read is not an empty shelf. The same distinction — and the same
 * markup — as /ureticiler/[slug], so a visitor is told the page is broken
 * rather than being told nobody has been published yet.
 */
function ProducersOutage() {
  return (
    <PageShell>
      <section aria-labelledby="producers-heading">
        <Heading />

        <div role="alert" className="wrap flex flex-col items-start pb-24 md:pb-32">
          <p className="font-theme-display text-3xl italic text-clay">
            Üretici profilleri şu anda yüklenemiyor.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
            Lütfen daha sonra yeniden deneyin.
          </p>
        </div>
      </section>
    </PageShell>
  )
}

export default async function ProducersPage() {
  if (isBrandPreview()) return <ProducersGrid producers={sourceProducers} />

  const result = await fetchPublicProducers(await createSupabaseServerClient())
  if (result.status === "error") return <ProducersOutage />

  return <ProducersGrid producers={result.producers} />
}
