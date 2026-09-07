import type { ProductSource } from "@/lib/products"

/**
 * Which product introduces each of the three sources on the homepage.
 *
 * The homepage section is an introduction, not a storefront row: one product
 * per source, no price, stock, badge or purchase control. What it shows used to
 * be three slugs written into content/homepage.ts, which meant renaming or
 * archiving a product in the dashboard silently pointed the homepage at a 404,
 * while the "anasayfa seçkisi" control on /admin/content wrote `is_featured`
 * that nothing read any more.
 *
 * This restores the meaning of that control without a new column: a product
 * introduces its source when it is active and featured, and display order
 * decides between several.
 *
 * Kept free of any database or Next.js import, like lib/shop-banner.ts, so the
 * rule itself can be unit tested directly.
 */

export interface IntroCandidate {
  slug: string
  source: ProductSource
  isActive: boolean
  isFeatured: boolean
  /** `products.display_order` — the order an administrator already controls. */
  displayOrder: number
  createdAt: string
}

/**
 * One slug per source, or no entry for a source with nothing featured — the
 * caller falls back to its curated entry for that source rather than borrowing
 * another source's product.
 */
export function pickIntroSlugPerSource(
  candidates: readonly IntroCandidate[],
): Partial<Record<ProductSource, string>> {
  const eligible = candidates
    .filter((candidate) => candidate.isActive && candidate.isFeatured)
    // Lowest display order first; the older product breaks a tie, so the same
    // catalogue always answers the same way regardless of row order.
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
      return a.slug.localeCompare(b.slug)
    })

  const chosen: Partial<Record<ProductSource, string>> = {}
  for (const candidate of eligible) {
    if (!chosen[candidate.source]) chosen[candidate.source] = candidate.slug
  }
  return chosen
}
