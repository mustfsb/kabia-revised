import Image from "next/image"
import Link from "next/link"
import { discountPercent, formatTL, inStock, sourceBadgeLabel, type Product } from "@/lib/products"
import { routes } from "@/lib/site"
import { isAllowedImageUrl } from "@/lib/shop-banner"

/**
 * One featured product as a slide: the image on one side, and beside it the
 * product said plainly — featured, where it comes from, its name, its price,
 * and the discount when there is one. The whole slide is the link.
 */
export function SliderProductSlide({ product, priority }: { product: Product; priority: boolean }) {
  const percent = discountPercent(product.price, product.originalPrice)
  const stockKnown = product.variants.length > 0
  const outOfStock = stockKnown && !inStock(product)
  const provenance =
    product.source === "ciftlik" || !product.producerName || product.producerName === product.name
      ? sourceBadgeLabel(product.source)
      : product.producerName

  return (
    <Link
      href={routes.product(product.slug)}
      prefetch={false}
      className="group grid h-full bg-paper md:grid-cols-2"
    >
      <div className="relative aspect-[4/5] overflow-hidden md:aspect-auto">
        {product.mainImageUrl && isAllowedImageUrl(product.mainImageUrl) ? (
          <Image
            src={product.mainImageUrl}
            alt={product.name}
            fill
            priority={priority}
            fetchPriority={priority ? "high" : undefined}
            sizes="(min-width: 1200px) 600px, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="label text-olive">Fotoğraf hazırlanıyor</span>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center px-6 py-10 md:px-12 md:py-12">
        <p className="label text-brand">Öne çıkan</p>
        <p className="label mt-5 text-olive">{provenance}</p>
        <h2 className="mt-2 text-3xl leading-[1.1] tracking-tight transition-colors duration-300 group-hover:text-brand md:text-4xl">
          {product.name}
        </h2>
        {product.defaultWeight && <p className="mt-2 text-sm text-ink/55">{product.defaultWeight}</p>}
        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="figure text-2xl text-ink">{formatTL(product.price)}</span>
          {percent && product.originalPrice != null && (
            <>
              <span className="figure text-base text-olive line-through">{formatTL(product.originalPrice)}</span>
              <span className="label text-brand">%{percent} indirim</span>
            </>
          )}
        </p>
        {outOfStock && <p className="label mt-3 text-clay">Stokta yok</p>}
        <span className="mt-8 inline-flex items-center gap-2 text-sm text-brand">
          Ürüne git
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </div>
    </Link>
  )
}
