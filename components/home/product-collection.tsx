import Image from "next/image";
import Link from "next/link";
import { products as copy } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";
import { ArrowLink } from "@/components/ui/button";
import { routes } from "@/lib/site";
import { isBrandPreview } from "@/lib/brand-preview";
import { previewProducts } from "@/content/preview-products";

/**
 * The three sources, one product each — an introduction, not a storefront.
 *
 * This section deliberately carries no price, stock, badge, description or
 * purchase control: those belong to /magaza and the product page. Each entry is
 * a single link wrapping its image, source name and product name, so the whole
 * tile is one target and there is no second action link to compete with it.
 *
 * The three products are curated in content/homepage.ts rather than read from
 * the catalogue, so the section stays fixed at three and cannot be reshuffled
 * by whatever is featured that week. That also means the homepage no longer
 * queries the catalogue at all.
 */
export function ProductCollection() {
  // With the gate on, each entry points at the local preview product for its
  // own source so the design review has something to click through to. With it
  // off — always, in normal operation — these are the verified real slugs.
  const preview = isBrandPreview();
  const hrefFor = (entry: (typeof copy.entries)[number]) => {
    if (!preview) return routes.product(entry.slug);
    const local = previewProducts.find((p) => p.source === entry.source);
    return routes.product(local ? local.slug : entry.slug);
  };

  return (
    <section
      id="urunler"
      aria-labelledby="products-heading"
      className="scroll-mt-20 border-y border-ink/10 bg-paper"
    >
      <div className="wrap py-24 md:py-32">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-7">
            <h2
              id="products-heading"
              className="text-3xl leading-[1.15] tracking-tight md:text-4xl"
            >
              {copy.statement[0]}
              <br />
              {copy.statement[1]}
              <br />
              <em className="font-theme-display italic text-ink/80">
                {copy.statement[2]}
              </em>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-4 md:col-start-9">
            <p className="text-sm leading-relaxed text-ink/60">{copy.intro}</p>
          </Reveal>
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {copy.entries.map((entry, index) => (
            <Reveal as="li" key={entry.slug} delay={index * 0.05} className="group">
              <Link href={hrefFor(entry)} className="block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-ivory">
                  <Image
                    src={entry.image}
                    alt={entry.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>

                <div className="mt-5 border-t border-ink/10 pt-4">
                  <p className="label text-olive">{entry.sourceName}</p>
                  <h3 className="mt-2 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
                    {entry.name}
                  </h3>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>

        <Reveal className="mt-14 border-t border-ink/10 pt-7">
          <ArrowLink href={routes.store}>Mağazayı gör</ArrowLink>
        </Reveal>
      </div>
    </section>
  );
}
