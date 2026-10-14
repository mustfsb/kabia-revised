/**
 * Single source for the catalogue order (Mağaza default sort).
 *
 * The recommended order used to live inline in store-listing; any second
 * manual order would drift from it. Badge classification needs no such
 * module: entry/detail read certification + source straight from the row.
 */

export const PRODUCT_ORDER = [
  "kabuklu-badem",
  "ceviz-ici",
  "findik-ici",
  "cicek-bali",
  "ihlamur",
  "domates-salcasi",
  "alic-sirkesi",
  "elma-sirkesi",
  "eriste",
  "tarhana",
] as const;

export function orderOf(slug: string): number {
  const i = (PRODUCT_ORDER as readonly string[]).indexOf(slug);
  return i === -1 ? PRODUCT_ORDER.length : i;
}
