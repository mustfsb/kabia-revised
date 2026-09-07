import Image from "next/image";
import Link from "next/link";
import { products as copy } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";
import { ArrowLink } from "@/components/ui/button";
import { routes } from "@/lib/site";
import { isBrandPreview } from "@/lib/brand-preview";
import { previewProducts } from "@/content/preview-products";
import { getCachedHomepageIntro } from "@/lib/catalog";
import { isPlausibleBannerImageUrl } from "@/lib/shop-banner";

/**
 * The three sources, one product each — an introduction, not a storefront.
 *
 * This section deliberately carries no price, stock, badge, description or
 * purchase control: those belong to /magaza and the product page. Each entry is
 * a single link wrapping its image, source name and product name, so the whole
 * tile is one target and there is no second action link to compete with it.
 *
 * The section stays fixed at three — one per source — and its statement lines,
 * intro and source names stay editorial, in content/homepage.ts. Which product
 * introduces each source is operational: it is the product an administrator
 * marked as featured on /admin/content, resolved by lib/homepage-intro.ts.
 *
 * The curated entry for a source is the fallback, used when that source has no
 * featured product and when the catalogue cannot be read at all. So the worst
 * case is today's behaviour, never an empty or broken section.
 */
export async function ProductCollection() {
  // With the gate on, each entry points at the local preview product for its
  // own source so the design review has something to click through to, and the
  // curated copy is left exactly as it is — preview behaviour is unchanged.
  const preview = isBrandPreview();
  const intro = preview ? {} : await getCachedHomepageIntro();

  const resolve = (entry: (typeof copy.entries)[number]) => {
    if (preview) {
      const local = previewProducts.find((p) => p.source === entry.source);
      return { ...entry, href: routes.product(local ? local.slug : entry.slug) };
    }

    const chosen = intro[entry.source];
    if (!chosen) return { ...entry, href: routes.product(entry.slug) };

    // next/image throws at render for a host outside the allowlist, which would
    // take the homepage down; an implausible product image keeps the curated
    // one. Same guard, and the same allowlist, as the shop banner.
    const usable = isPlausibleBannerImageUrl(chosen.mainImageUrl);
    return {
      ...entry,
      name: chosen.name,
      image: usable ? chosen.mainImageUrl : entry.image,
      alt: usable ? chosen.name : entry.alt,
      href: routes.product(chosen.slug),
    };
  };

  const entries = copy.entries.map(resolve);

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
          {entries.map((entry, index) => (
            <Reveal as="li" key={entry.source} delay={index * 0.05} className="group">
              <Link href={entry.href} className="block">
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
          <ArrowLink href={routes.store}>Tüm ürünleri gör</ArrowLink>
        </Reveal>
      </div>
    </section>
  );
}
