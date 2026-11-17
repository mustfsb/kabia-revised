import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  autoplayInitiallyOn,
  resolveSliderView,
  shopSliderSaveSchema,
  SLIDER_BELOW_COUNT,
  SLIDER_INTERVAL_MS,
  SLIDER_MAX_FEATURED,
  SLIDER_MAX_SLIDES,
} from "@/lib/shop-slider"
import { discountPercent, type Product } from "@/lib/products"

const SB = "https://proj.supabase.co"
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const product = (n: number): Product => ({ id: uuid(n), slug: `urun-${n}`, name: `Ürün ${n}`, price: 100 }) as unknown as Product

const imageSlide = {
  id: "s1",
  media_bucket: "product-media",
  media_path: "slider/2026-11/a-abcdef12.jpg",
  media_mime: "image/jpeg",
  poster_bucket: null,
  poster_path: null,
  headline: "Yeni hasat",
  alt_text: "Bahçe",
  link_href: "/magaza?kategori=badem",
  link_label: "İncele",
  sort_order: 0,
}
const videoSlide = {
  ...imageSlide,
  id: "s2",
  media_bucket: "content-video",
  media_path: "slider/2026-11/v-abcdef12.mp4",
  media_mime: "video/mp4",
  poster_bucket: "product-media",
  poster_path: "slider/2026-11/p-abcdef12.jpg",
  headline: null,
  link_href: null,
  link_label: null,
  sort_order: 1,
}

describe("slider constants", () => {
  it("pins the agreed limits", () => {
    assert.equal(SLIDER_MAX_SLIDES, 6)
    assert.equal(SLIDER_MAX_FEATURED, 12)
    assert.equal(SLIDER_BELOW_COUNT, 3)
    assert.equal(SLIDER_INTERVAL_MS, 5000)
  })
})

describe("resolveSliderView", () => {
  const products = Array.from({ length: 6 }, (_, i) => product(i + 1))
  const featured = [5, 1, 3, 2].map((n, i) => ({ product_id: uuid(n), sort_order: i }))

  it("is nothing when the slider is off or could not be read", () => {
    assert.equal(resolveSliderView({ config: { mode: "off", show_featured_below: true }, slides: [imageSlide], featured, products, supabaseUrl: SB }), null)
    assert.equal(resolveSliderView({ config: null, slides: [imageSlide], featured, products, supabaseUrl: SB }), null)
  })

  it("media mode: slides in order with Storage URLs, the first three featured below", () => {
    const view = resolveSliderView({
      config: { mode: "media", show_featured_below: true },
      slides: [videoSlide, imageSlide],
      featured,
      products,
      supabaseUrl: SB,
    })
    assert.ok(view && view.mode === "media")
    assert.deepEqual(view.slides.map((s) => s.id), ["s1", "s2"])
    assert.equal(view.slides[0].kind, "image")
    assert.equal(view.slides[0].src, `${SB}/storage/v1/object/public/product-media/slider/2026-11/a-abcdef12.jpg`)
    assert.equal(view.slides[1].kind, "video")
    assert.equal(view.slides[1].posterSrc, `${SB}/storage/v1/object/public/product-media/slider/2026-11/p-abcdef12.jpg`)
    assert.deepEqual(view.below.map((p) => p.id), [uuid(5), uuid(1), uuid(3)])
  })

  it("media mode without the switch shows no products below", () => {
    const view = resolveSliderView({ config: { mode: "media", show_featured_below: false }, slides: [imageSlide], featured, products, supabaseUrl: SB })
    assert.ok(view && view.mode === "media")
    assert.deepEqual(view.below, [])
  })

  it("media mode with no slides is nothing", () => {
    assert.equal(resolveSliderView({ config: { mode: "media", show_featured_below: true }, slides: [], featured, products, supabaseUrl: SB }), null)
  })

  it("products mode keeps the featured order and drops products that are no longer published", () => {
    const view = resolveSliderView({
      config: { mode: "products", show_featured_below: false },
      slides: [imageSlide],
      featured: [...featured, { product_id: uuid(99), sort_order: 4 }],
      products,
      supabaseUrl: SB,
    })
    assert.ok(view && view.mode === "products")
    assert.deepEqual(view.products.map((p) => p.id), [uuid(5), uuid(1), uuid(3), uuid(2)])
  })

  it("products mode with every product gone is nothing", () => {
    assert.equal(
      resolveSliderView({ config: { mode: "products", show_featured_below: false }, slides: [], featured: [{ product_id: uuid(99), sort_order: 0 }], products, supabaseUrl: SB }),
      null,
    )
  })

  it("a slide whose media copy is missing is skipped", () => {
    const view = resolveSliderView({
      config: { mode: "media", show_featured_below: false },
      slides: [{ ...imageSlide, media_path: null }, videoSlide],
      featured: [],
      products,
      supabaseUrl: SB,
    })
    assert.ok(view && view.mode === "media")
    assert.deepEqual(view.slides.map((s) => s.id), ["s2"])
  })
})

describe("shopSliderSaveSchema", () => {
  const slide = { media_asset_id: uuid(1), poster_asset_id: null, headline: "", alt_text: "", link_href: "", link_label: "" }
  const valid = { mode: "media", show_featured_below: true, slides: [slide], featured: [uuid(2)] }

  it("accepts a media slider and empties blank fields", () => {
    const parsed = shopSliderSaveSchema.parse(valid)
    assert.equal(parsed.slides[0].headline, null)
    assert.equal(parsed.slides[0].link_href, null)
  })

  it("limits slides to 6 and featured products to 12, without repeats", () => {
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, slides: Array(7).fill(slide) }).success, false)
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, featured: Array.from({ length: 13 }, (_, i) => uuid(i + 1)) }).success, false)
    assert.ok(shopSliderSaveSchema.safeParse({ ...valid, featured: Array.from({ length: 12 }, (_, i) => uuid(i + 1)) }).success)
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, featured: [uuid(2), uuid(2)] }).success, false)
  })

  it("needs content for the chosen mode", () => {
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, slides: [] }).success, false)
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, mode: "products", featured: [] }).success, false)
    assert.ok(shopSliderSaveSchema.safeParse({ mode: "off", show_featured_below: false, slides: [], featured: [] }).success)
  })

  it("a link is an in-site path with a label, nothing else", () => {
    const withLink = (link_href: string, link_label = "İncele") => ({ ...valid, slides: [{ ...slide, link_href, link_label }] })
    assert.ok(shopSliderSaveSchema.safeParse(withLink("/magaza?kategori=badem")).success)
    for (const bad of ["https://evil.example.com", "//evil.example.com", "javascript:alert(1)", "/\\evil", "magaza"]) {
      assert.equal(shopSliderSaveSchema.safeParse(withLink(bad)).success, false, bad)
    }
    assert.equal(shopSliderSaveSchema.safeParse(withLink("/magaza", "")).success, false, "a link needs a label")
    assert.equal(shopSliderSaveSchema.safeParse(withLink("", "İncele")).success, false, "a label needs a link")
  })

  it("limits headline, alt text and label to the database's lengths", () => {
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, slides: [{ ...slide, headline: "x".repeat(81) }] }).success, false)
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, slides: [{ ...slide, alt_text: "x".repeat(201) }] }).success, false)
    assert.equal(shopSliderSaveSchema.safeParse({ ...valid, slides: [{ ...slide, link_href: "/a", link_label: "x".repeat(31) }] }).success, false)
  })
})

describe("autoplay and discounts", () => {
  it("autoplay starts off for reduced motion", () => {
    assert.equal(autoplayInitiallyOn(true), false)
    assert.equal(autoplayInitiallyOn(false), true)
  })

  it("discountPercent rounds to a whole percent and ignores non-discounts", () => {
    assert.equal(discountPercent(450, 520), 13)
    assert.equal(discountPercent(450, 450), null)
    assert.equal(discountPercent(450, undefined), null)
    assert.equal(discountPercent(450, 300), null)
    assert.equal(discountPercent(999, 1000), null, "under half a percent is not worth claiming")
  })
})

describe("combineSliderRead", () => {
  it("a failed slider read means no slider, never an error page", async () => {
    const { combineSliderRead } = await import("@/lib/shop-slider")
    assert.equal(combineSliderRead({ status: "error" }, { status: "ok", products: [product(1)] }, SB), null)
  })

  it("a failed catalogue read drops the products but keeps a media slider", async () => {
    const { combineSliderRead } = await import("@/lib/shop-slider")
    const read = {
      status: "ok" as const,
      config: { mode: "media", show_featured_below: true },
      slides: [imageSlide],
      featured: [{ product_id: uuid(1), sort_order: 0 }],
    }
    const media = combineSliderRead(read, { status: "error" }, SB)
    assert.ok(media && media.mode === "media")
    assert.deepEqual(media.below, [])
    assert.equal(combineSliderRead({ ...read, config: { mode: "products", show_featured_below: false } }, { status: "error" }, SB), null)
  })
})
