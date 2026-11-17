import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"
import { mediaKindOf, type MediaKind } from "@/lib/admin/media"
import type { SliderMode } from "@/lib/shop-slider"

/**
 * What the slider editor starts from. Media are resolved through media_assets
 * (the administrator can read it) so each slide shows a real preview and label.
 */

export interface AdminSlideMedia {
  id: string
  url: string
  label: string
  kind: MediaKind
}

export interface AdminSlide {
  media: AdminSlideMedia
  poster: AdminSlideMedia | null
  headline: string
  altText: string
  linkHref: string
  linkLabel: string
}

export interface AdminSliderProduct {
  id: string
  name: string
  price: number
  imageUrl: string | null
}

export interface ShopSliderAdmin {
  mode: SliderMode
  showFeaturedBelow: boolean
  slides: AdminSlide[]
  featured: string[]
  products: AdminSliderProduct[]
  /** True when the slider tables could not be read (e.g. not migrated yet). */
  unavailable: boolean
}

const EMPTY: ShopSliderAdmin = { mode: "off", showFeaturedBelow: false, slides: [], featured: [], products: [], unavailable: true }

export async function loadShopSliderAdmin(supabase: SupabaseClient): Promise<ShopSliderAdmin> {
  const [config, slides, featured, products] = await Promise.all([
    supabase.from("shop_slider_config").select("mode, show_featured_below").maybeSingle(),
    supabase
      .from("shop_slides")
      .select("media_asset_id, poster_asset_id, headline, alt_text, link_href, link_label, sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("shop_featured_products").select("product_id, sort_order").order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, base_price, main_image_url")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(200),
  ])

  for (const [context, result] of [
    ["slider:config", config],
    ["slider:slides", slides],
    ["slider:featured", featured],
    ["slider:products", products],
  ] as const) {
    if (result.error) {
      logQueryError(context, result.error)
      return EMPTY
    }
  }

  type SlideRaw = {
    media_asset_id: string
    poster_asset_id: string | null
    headline: string | null
    alt_text: string | null
    link_href: string | null
    link_label: string | null
  }
  const slideRows = (slides.data ?? []) as SlideRaw[]

  const assetIds = [...new Set(slideRows.flatMap((s) => [s.media_asset_id, s.poster_asset_id]).filter(Boolean))] as string[]
  const assets = new Map<string, AdminSlideMedia>()
  if (assetIds.length > 0) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id, bucket_id, object_path, original_filename, display_name, mime_type")
      .in("id", assetIds)
    if (error) {
      logQueryError("slider:assets", error)
      return EMPTY
    }
    for (const row of (data ?? []) as {
      id: string
      bucket_id: string
      object_path: string
      original_filename: string
      display_name: string | null
      mime_type: string
    }[]) {
      assets.set(row.id, {
        id: row.id,
        url: supabase.storage.from(row.bucket_id).getPublicUrl(row.object_path).data.publicUrl,
        label: row.display_name?.trim() || row.original_filename,
        kind: mediaKindOf(row.mime_type),
      })
    }
  }

  const raw = config.data as { mode: string; show_featured_below: boolean } | null
  const mode: SliderMode = raw?.mode === "media" || raw?.mode === "products" ? raw.mode : "off"

  return {
    mode,
    showFeaturedBelow: raw?.show_featured_below ?? false,
    slides: slideRows.flatMap((row) => {
      const media = assets.get(row.media_asset_id)
      if (!media) return []
      return [
        {
          media,
          poster: row.poster_asset_id ? (assets.get(row.poster_asset_id) ?? null) : null,
          headline: row.headline ?? "",
          altText: row.alt_text ?? "",
          linkHref: row.link_href ?? "",
          linkLabel: row.link_label ?? "",
        },
      ]
    }),
    featured: ((featured.data ?? []) as { product_id: string }[]).map((row) => row.product_id),
    products: ((products.data ?? []) as { id: string; name: string; base_price: number | string; main_image_url: string | null }[]).map(
      (row) => ({ id: row.id, name: row.name, price: Number(row.base_price), imageUrl: row.main_image_url }),
    ),
    unavailable: false,
  }
}
