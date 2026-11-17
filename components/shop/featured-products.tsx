import { ProductEntry } from "@/components/shop/product-entry"
import type { Product } from "@/lib/products"

/**
 * The featured products under a media slider: the shop's own entries, in the
 * same three-up grid, each marked "Öne çıkan". They stay in the listing below
 * too — this is emphasis, not a separate shelf.
 */
export function FeaturedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null
  return (
    <section aria-labelledby="featured-heading" className="wrap mt-12 md:mt-16">
      <h2 id="featured-heading" className="label pb-5 text-olive">
        Öne çıkanlar
      </h2>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductEntry key={product.id} product={product} featured />
        ))}
      </ul>
    </section>
  )
}
