// Product catalog type definitions + pure UI helpers.
// Catalog DATA now lives in Supabase (see lib/catalog.ts). This file keeps the
// shared TypeScript interfaces and the formatTL / category-label helpers used
// across the UI. No mock business data remains here.

/**
 * A category slug as it exists in the `categories` table.
 *
 * This was a closed union of five almond slugs with a matching hardcoded
 * label list. Administrators can create categories from /admin/categories,
 * so the two drifted apart completely: the union still named kavrulmus,
 * badem-unu, badem-ezmesi and paketli-urunler — none of which are in the
 * database — while the nine categories that actually hold products (sirke,
 * bal, ceviz, findik, ihlamur, kabuklu-badem, salca, tarhana, eriste) were
 * named nowhere in the code. The mapper's fallback then quietly labelled
 * every single product "Çiğ Badem".
 *
 * A union cannot track a table somebody edits at runtime, so it no longer
 * tries. The slug is whatever the row says, and its display name travels
 * with it — see `Product.categoryLabel` — rather than being looked up in a
 * copy of the table kept over here.
 */
export type ProductCategory = string

/** The one category id that is not a row: the unfiltered state. */
export const ALL_CATEGORIES = "tumu"

/** Which of Kabia's three product lines this belongs to. */
export type ProductSource = "ciftlik" | "secki" | "mutfak"

// UI label config — the matching `products.source` values are the enum
// public.product_source ('ciftlik' | 'secki' | 'mutfak').
export const SOURCES: { id: ProductSource | "tumu"; label: string; badgeLabel: string }[] = [
  { id: "tumu", label: "Tümü", badgeLabel: "" },
  { id: "ciftlik", label: "Çiftlik", badgeLabel: "Kabia Çiftliği" },
  { id: "secki", label: "Seçki", badgeLabel: "Kabia Seçki" },
  { id: "mutfak", label: "Mutfak", badgeLabel: "Kabia Mutfak" },
]

export function sourceBadgeLabel(id: ProductSource) {
  return SOURCES.find((s) => s.id === id)?.badgeLabel ?? id
}

/**
 * Legal-weight label — see the Phase 2 migration comment on
 * `products.certification`. `organik_sertifikali` asserts a real organic
 * certificate; the other two express Kabia's own selection approach and must
 * never be described using the word "organik".
 */
export type ProductCertification = "organik_sertifikali" | "kabia_secki" | "kabia_mutfak"

export const CERTIFICATION_LABEL: Record<ProductCertification, string> = {
  organik_sertifikali: "Organik Sertifikalı",
  kabia_secki: "Kabia Seçki",
  kabia_mutfak: "Kabia Mutfak",
}

/** Whether this certification value may be described as organic anywhere in the UI. */
export function isOrganicCertified(certification: ProductCertification): boolean {
  return certification === "organik_sertifikali"
}

export interface ProductVariant {
  id: string
  weight: string
  price: number
  /** `product_variants.stock_quantity`; 0 means the size cannot be ordered. */
  stock: number
}

export interface NutritionInfo {
  kalori: string
  protein: string
  karbonhidrat: string
  yag: string
  lif: string
  sodyum: string
}

export interface ProductReview {
  name: string
  avatarSeed: number
  date: string
  rating: number
  text: string
  verified: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  category: ProductCategory
  /** The category's display name, read from the same row as the slug. */
  categoryLabel: string
  source: ProductSource
  defaultWeight: string
  price: number
  originalPrice?: number
  seed: string
  mainImageUrl: string
  images: string[]
  variants: ProductVariant[]
  rating: number
  reviewCount: number
  ratingBreakdown: [number, number, number, number, number]
  shortDescription: string
  description: string
  origin: string
  productionMethod: string
  shelfLife: string
  storage: string
  certificates: string
  certification: ProductCertification
  producerId: string | null
  producerName: string
  producerSlug: string
  producerWhySelected: string
  harvestYear: number | null
  lotCode: string
  variety: string
  rootstock: string
  processing: string
  allergens: string
  netWeight: string
  nutrition: NutritionInfo
  reviews: ProductReview[]
}

/** A product is orderable while any of its sizes still has stock. */
export function inStock(product: Pick<Product, "variants">): boolean {
  return product.variants.some((v) => v.stock > 0)
}

export function formatTL(amount: number): string {
  return `₺${amount.toFixed(2).replace(".", ",")}`
}
