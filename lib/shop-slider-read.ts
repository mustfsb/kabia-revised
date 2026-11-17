import type { SupabaseClient } from "@supabase/supabase-js"
import { honestCache } from "@/lib/honest-cache"
import { getCachedPublicProducts } from "@/lib/catalog"
import {
  combineSliderRead,
  type FeaturedRow,
  type ShopSliderView,
  type SliderConfigRow,
  type SlideRow,
  type SliderReadResult,
} from "@/lib/shop-slider"

/** Revalidated by the slider save; the catalogue keeps its own tag. */
export const SHOP_SLIDER_TAG = "shop-slider"

const SLIDE_COLUMNS =
  "id, media_bucket, media_path, media_mime, poster_bucket, poster_path, headline, alt_text, link_href, link_label, sort_order"

export async function fetchShopSlider(client: SupabaseClient): Promise<SliderReadResult> {
  const [config, slides, featured] = await Promise.all([
    client.from("shop_slider_config").select("mode, show_featured_below").maybeSingle(),
    client.from("shop_slides").select(SLIDE_COLUMNS).order("sort_order", { ascending: true }),
    client.from("shop_featured_products").select("product_id, sort_order").order("sort_order", { ascending: true }),
  ])
  if (config.error || slides.error || featured.error) return { status: "error" }
  return {
    status: "ok",
    config: (config.data ?? null) as SliderConfigRow | null,
    slides: (slides.data ?? []) as SlideRow[],
    featured: (featured.data ?? []) as FeaturedRow[],
  }
}

const getCachedShopSlider = honestCache(
  "shop slider",
  fetchShopSlider,
  (r) => r.status === "error",
  { status: "error" } as SliderReadResult,
  ["kabia-shop-slider-v1"],
  { revalidate: 300, tags: [SHOP_SLIDER_TAG] },
)

/** The /magaza slider, or null when there is none to show (or it cannot be read). */
export async function getShopSliderView(): Promise<ShopSliderView | null> {
  const [slider, catalogue] = await Promise.all([getCachedShopSlider(), getCachedPublicProducts()])
  return combineSliderRead(slider, catalogue, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
}
