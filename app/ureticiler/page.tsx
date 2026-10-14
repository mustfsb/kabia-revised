import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import { ProducerCard } from "@/components/producers/producer-card"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchPublicProducers } from "@/lib/producers"
import { producerCollections, sourceProducers } from "@/content/producers"
import { isBrandPreview } from "@/lib/brand-preview"

/**
 * Elle dizilim: badem → ceviz → fındık → bal → ıhlamur → salça →
 * alıç → elma → erişte → tarhana. (Ihlamur listede yoktu, baldan
 * sonra Seçki grubuna eklendi.) Listede olmayanlar en sonda.
 */
const ORDER = [
  "kabia-ciftligi",
  "ege-ceviz",
  "geyce-setce-findik",
  "anadolu-bal",
  "akinci-ihlamur",
  "domates-salcasi",
  "alic-sirkesi",
  "elma-sirkesi",
  "eriste",
  "tarhana",
]
const orderOf = (slug: string): number => {
  const i = ORDER.indexOf(slug)
  return i === -1 ? ORDER.length : i
}

export const metadata: Metadata = {
  title: "Üreticiler",
  description: "Kabia'nın ürünlerini bir araya getirdiği, güvendiği küçük üreticiler.",
  alternates: { canonical: "/ureticiler" },
}

export default async function ProducersPage() {
  const unsorted = isBrandPreview()
    ? sourceProducers
    : await fetchPublicProducers(await createSupabaseServerClient())
  const producers = [...unsorted].sort((a, b) => orderOf(a.slug) - orderOf(b.slug))

  return (
    <PageShell>
      <section aria-labelledby="producers-heading">
        <div className="wrap page-top pb-16 md:pb-24">
          <p className="label text-olive">Hepsi bir arada</p>
          <h1 id="producers-heading" className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
            Çiftliğimiz ve <em className="font-theme-display italic text-brand">dost üreticiler</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Kabia Çiftliği dahil, tanıdığımız herkes tek listede: Seçki
            üreticileri ve mutfak hikâyeleriyle birlikte.
          </p>
        </div>

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
