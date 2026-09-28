import { ALL_CATEGORIES, SOURCES, type Product } from "@/lib/products";
import { orderOf } from "@/lib/shop-badges";

export const SORT_OPTIONS = [
  { id: "onerilen", label: "Varsayılan" },
  { id: "fiyat-artan", label: "Fiyat: artan" },
  { id: "fiyat-azalan", label: "Fiyat: azalan" },
] as const;

export function selectProducts(
  products: readonly Product[],
  category: string,
  source: string,
  sort: string,
): Product[] {
  const filtered = products.filter(
    (p) =>
      (category === "tumu" || category === p.category) &&
      (source === "tumu" || source === p.source),
  );
  if (sort === "fiyat-artan") filtered.sort((a, b) => a.price - b.price);
  else if (sort === "fiyat-azalan") filtered.sort((a, b) => b.price - a.price);
  else filtered.sort((a, b) => orderOf(a.slug) - orderOf(b.slug));
  return filtered;
}

/** The three sources, narrowed to those the current catalogue actually has. */
export function presentSources(products: readonly Product[]) {
  return SOURCES.filter(
    (source) =>
      source.id === "tumu" || products.some((p) => p.source === source.id),
  );
}

/**
 * Categories narrowed to what is present, and — once a source is chosen —
 * to what is present *within that source*, so the bar never offers a
 * combination that resolves to an empty grid.
 */
export function presentCategories(products: readonly Product[], source: string) {
  const scope =
    source === "tumu" ? products : products.filter((p) => p.source === source);
  // Built from the products in scope rather than filtered out of a fixed
  // list, so a category an administrator adds appears here the moment a
  // product is in it, and one that is emptied disappears. Each product
  // carries its own label, so the bar never has to look one up.
  const seen = new Map<string, string>();
  for (const product of scope) {
    if (product.category && !seen.has(product.category)) {
      seen.set(product.category, product.categoryLabel || product.category);
    }
  }
  return [
    { id: ALL_CATEGORIES, label: "Tümü" },
    ...[...seen]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr")),
  ];
}

export function listingHref(
  base: string,
  category: string,
  source: string,
  sort: string,
): string {
  const params = new URLSearchParams();
  if (category !== "tumu") params.set("kategori", category);
  if (source !== "tumu") params.set("kaynak", source);
  if (sort !== "onerilen") params.set("sirala", sort);
  return params.size ? `${base}?${params}` : base;
}
