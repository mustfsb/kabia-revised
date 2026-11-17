import { z } from "zod"
import { isVideoMime, publicMediaUrl } from "@/lib/admin/media"
import type { Product } from "@/lib/products"

/**
 * The /magaza slider — its rules, in one pure module.
 *
 * Kept free of Supabase and Next so the view rules and the save schema are
 * testable directly. The cached read lives in lib/shop-slider-read.ts, the save
 * in app/admin/(protected)/content/slider-actions.ts, and the database enforces
 * the same limits again (supabase/migrations/20261117000100_shop_slider.sql).
 */

export const SLIDER_MAX_SLIDES = 6
export const SLIDER_MAX_FEATURED = 12
/** Under a media slider, this many featured products sit as cards. */
export const SLIDER_BELOW_COUNT = 3
export const SLIDER_INTERVAL_MS = 5000

export const SLIDER_MODES = ["off", "media", "products"] as const
export type SliderMode = (typeof SLIDER_MODES)[number]

export interface SliderConfigRow {
  mode: string
  show_featured_below: boolean
}

export interface SlideRow {
  id: string
  media_bucket: string | null
  media_path: string | null
  media_mime: string | null
  poster_bucket: string | null
  poster_path: string | null
  headline: string | null
  alt_text: string | null
  link_href: string | null
  link_label: string | null
  sort_order: number
}

export interface FeaturedRow {
  product_id: string
  sort_order: number
}

export interface SliderSlide {
  id: string
  kind: "image" | "video"
  src: string
  posterSrc: string | null
  headline: string | null
  alt: string | null
  linkHref: string | null
  linkLabel: string | null
}

export type ShopSliderView =
  | { mode: "media"; slides: SliderSlide[]; below: Product[] }
  | { mode: "products"; products: Product[] }

function toSlide(row: SlideRow, supabaseUrl: string): SliderSlide | null {
  if (!row.media_bucket || !row.media_path || !row.media_mime || !supabaseUrl) return null
  const video = isVideoMime(row.media_mime)
  return {
    id: row.id,
    kind: video ? "video" : "image",
    src: publicMediaUrl(supabaseUrl, row.media_bucket, row.media_path),
    posterSrc: video && row.poster_bucket && row.poster_path ? publicMediaUrl(supabaseUrl, row.poster_bucket, row.poster_path) : null,
    headline: row.headline,
    alt: row.alt_text,
    linkHref: row.link_href && row.link_label ? row.link_href : null,
    linkLabel: row.link_href && row.link_label ? row.link_label : null,
  }
}

/**
 * What the storefront renders, or null for "no slider".
 *
 * `products` is the published catalogue: a featured product that has since been
 * archived or deleted is simply not in it, so it drops out here. A mode left with
 * nothing to show renders nothing rather than an empty frame.
 */
export function resolveSliderView(input: {
  config: SliderConfigRow | null
  slides: SlideRow[]
  featured: FeaturedRow[]
  products: Product[]
  supabaseUrl: string
}): ShopSliderView | null {
  const { config, slides, featured, products, supabaseUrl } = input
  if (!config || (config.mode !== "media" && config.mode !== "products")) return null

  const byId = new Map(products.map((p) => [p.id, p]))
  const chosen = [...featured]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => byId.get(row.product_id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, SLIDER_MAX_FEATURED)

  if (config.mode === "products") return chosen.length > 0 ? { mode: "products", products: chosen } : null

  const shown = [...slides]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => toSlide(row, supabaseUrl))
    .filter((s): s is SliderSlide => s !== null)
    .slice(0, SLIDER_MAX_SLIDES)
  if (shown.length === 0) return null
  return { mode: "media", slides: shown, below: config.show_featured_below ? chosen.slice(0, SLIDER_BELOW_COUNT) : [] }
}

/** Reduced motion: the slider does not start moving on its own. */
export function autoplayInitiallyOn(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion
}

// ---- save schema --------------------------------------------------------------

const blankToNull = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .nullish()
    .transform((v) => v || null)

const uuid = z.string().uuid("Geçersiz kimlik.")

/** An in-site path only: "/x…", never "//host", a scheme, a backslash or a control character. */
const IN_SITE_PATH = /^\/(?![/\\])[^\s\\\u0000-\u001f]*$/

const slideSchema = z
  .object({
    media_asset_id: uuid,
    poster_asset_id: z.union([z.literal(""), z.null(), z.undefined(), uuid]).transform((v) => v || null),
    headline: blankToNull(80, "Başlık"),
    alt_text: blankToNull(200, "Alternatif metin"),
    link_href: blankToNull(300, "Link").refine((v) => v === null || IN_SITE_PATH.test(v), {
      message: "Link site içinde bir adres olmalı ve / ile başlamalı (ör. /magaza?kategori=badem).",
    }),
    link_label: blankToNull(30, "Buton yazısı"),
  })
  .refine((s) => (s.link_href === null) === (s.link_label === null), {
    message: "Link ve buton yazısı birlikte doldurulmalı ya da ikisi de boş bırakılmalı.",
    path: ["link_label"],
  })

export const shopSliderSaveSchema = z
  .object({
    mode: z.enum(SLIDER_MODES, { message: "Gösterim türü geçersiz." }),
    show_featured_below: z.boolean(),
    slides: z.array(slideSchema).max(SLIDER_MAX_SLIDES, `En fazla ${SLIDER_MAX_SLIDES} slayt eklenebilir.`),
    featured: z
      .array(uuid)
      .max(SLIDER_MAX_FEATURED, `En fazla ${SLIDER_MAX_FEATURED} öne çıkan ürün seçilebilir.`)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Aynı ürün birden fazla kez seçilemez." }),
  })
  .refine((v) => v.mode !== "media" || v.slides.length > 0, {
    message: "Medya slider'ı için en az bir slayt ekleyin.",
    path: ["slides"],
  })
  .refine((v) => v.mode !== "products" || v.featured.length > 0, {
    message: "Öne çıkan ürünler için en az bir ürün seçin.",
    path: ["featured"],
  })

export type ShopSliderSaveInput = z.infer<typeof shopSliderSaveSchema>

// ---- combining the reads --------------------------------------------------------

export type SliderReadResult =
  | { status: "ok"; config: SliderConfigRow | null; slides: SlideRow[]; featured: FeaturedRow[] }
  | { status: "error" }

/**
 * A slider that cannot be read is not shown: the shop opens as it would without
 * one, never with an error where the slider would be. A catalogue that cannot be
 * read leaves a media slider standing but shows no products from it.
 */
export function combineSliderRead(
  slider: SliderReadResult,
  catalogue: { status: "ok"; products: Product[] } | { status: "error" },
  supabaseUrl: string,
): ShopSliderView | null {
  if (slider.status !== "ok") return null
  return resolveSliderView({
    config: slider.config,
    slides: slider.slides,
    featured: slider.featured,
    products: catalogue.status === "ok" ? catalogue.products : [],
    supabaseUrl,
  })
}
