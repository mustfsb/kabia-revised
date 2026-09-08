import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { StoreListing, type StoreSearch } from "@/components/shop/store-listing";
import { ShopHeroBanner } from "@/components/shop/shop-hero-banner";
import { isBrandPreview } from "@/lib/brand-preview";
import { sourceProducers } from "@/content/producers";
import { previewProducts } from "@/content/preview-products";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPublishedProducerBySlug, splitStoryParagraphs } from "@/lib/producers";
import { fetchProductsByProducer } from "@/lib/catalog";
import { getPublicSettings } from "@/lib/settings";
import { shopBannerVisible, type ShopBannerSettings } from "@/lib/shop-banner";
import { routes } from "@/lib/site";

type Params = Promise<{ "producer-slug": string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const slug = (await params)["producer-slug"];
  if (isBrandPreview()) {
    const producer = sourceProducers.find((producer) => producer.slug === slug);
    return {
      title: producer ? `${producer.name} — Mağaza` : "Mağaza bulunamadı",
      robots: { index: false, follow: false },
    };
  }
  const supabase = await createSupabaseServerClient();
  const result = await fetchPublishedProducerBySlug(supabase, slug);
  if (result.status !== "ok") return { title: "Mağaza bulunamadı" };
  return {
    title: `${result.producer.name} — Mağaza`,
    description:
      result.producer.story ??
      `${result.producer.name} — Kabia'nın güvendiği üreticilerden.`,
  };
}

export default async function ProducerStore({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<StoreSearch>;
}) {
  const slug = (await params)["producer-slug"];

  // Design-review preview: local editorial producers and example products.
  if (isBrandPreview()) {
    const producer = sourceProducers.find((producer) => producer.slug === slug);
    if (!producer) notFound();
    const products = previewProducts.filter(
      (product) => product.producerSlug === producer.slug,
    );

    return (
      <PageShell>
        <section className="wrap page-top">
          <p className="label text-olive">Mağaza</p>
          <h1 className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
            {producer.name}
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            {producer.desc}
          </p>

          <div className="mt-14 md:mt-20">
            <StoreListing
              products={products}
              base={`/magaza/${producer.slug}`}
              search={await searchParams}
            />
          </div>
        </section>
      </PageShell>
    );
  }

  // Normal operation: the producer and its products come from the database,
  // so /magaza/[slug] reads like the main store with a narrower catalogue.
  // A read failure answers like an unknown slug — the test-double catalogue
  // has no producers, which keeps the off-state 404 expectations intact.
  const supabase = await createSupabaseServerClient();
  const result = await fetchPublishedProducerBySlug(supabase, slug);
  if (result.status !== "ok") notFound();
  const producer = result.producer;
  const products = await fetchProductsByProducer(supabase, producer.id);
  const subtitle = [producer.productType, producer.region]
    .filter(Boolean)
    .join(" — ");
  const excerpt = splitStoryParagraphs(producer.story)[0] ?? null;

  // The global shop banner, behind the same visibility rule as /shop — the
  // route simply never read settings before. Same component, same position
  // above the page section, so a producer store reads as one more store page.
  const settings = await getPublicSettings();
  const banner: ShopBannerSettings = {
    enabled: settings.shopBannerEnabled,
    headline: settings.shopBannerHeadline,
    subtext: settings.shopBannerSubtext,
    imageUrl: settings.shopBannerImageUrl,
    ctaLabel: settings.shopBannerCtaLabel,
    ctaHref: settings.shopBannerCtaHref,
  };
  const showBanner = shopBannerVisible(banner);

  return (
    <PageShell>
      {showBanner && (
        <ShopHeroBanner
          headline={banner.headline}
          subtext={banner.subtext}
          imageUrl={banner.imageUrl}
          ctaLabel={banner.ctaLabel}
          ctaHref={banner.ctaHref}
        />
      )}
      <section className="wrap page-top">
        <p className="label text-olive">Mağaza</p>
        <h1 className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
          {producer.name}
        </h1>
        {subtitle && (
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            {subtitle}
          </p>
        )}
        {producer.tagline && (
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink/65">
            {producer.tagline}
          </p>
        )}

        {producer.photoUrl && (
          <div className="relative mt-10 aspect-[16/9] max-w-4xl overflow-hidden rounded-media bg-paper">
            <Image
              src={producer.photoUrl}
              alt={producer.name}
              fill
              sizes="(min-width: 1024px) 56rem, 100vw"
              className="object-cover"
            />
          </div>
        )}

        {excerpt && (
          <div className="mt-8 max-w-[42rem]">
            <p className="text-base leading-relaxed text-ink/70">{excerpt}</p>
            <Link
              href={routes.producer(producer.slug)}
              prefetch={false}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
            >
              Hikâyenin tamamı
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}

        <div className="mt-14 md:mt-20">
          <StoreListing
            products={products}
            base={`/magaza/${producer.slug}`}
            search={await searchParams}
          />
        </div>
      </section>
    </PageShell>
  );
}
