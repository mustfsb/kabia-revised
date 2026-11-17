import type { MediaAsset, MediaUsage, MediaUsageKind } from "@/lib/admin/media"

/**
 * Which records point at each media asset — the pure half of usage detection.
 *
 * Kept free of Supabase and Next so it can be tested directly. The queries that
 * feed it live in lib/admin/queries/media.ts.
 *
 * An image can be referenced from a product (main image + gallery), a producer
 * (photo) or a journal entry (cover + gallery). Each reference is matched by the
 * asset's public URL *and* by its object path: rows created through the library
 * carry a path, older rows carry only a URL, and checking one spelling would let
 * a live image be deleted.
 */

export interface UsageRows {
  productGallery: {
    image_url: string
    storage_path: string | null
    products: { id: string; name: string } | null
  }[]
  productMain: { id: string; name: string; main_image_url: string }[]
  producers: { id: string; name: string; photo_url: string | null }[]
  journalCover: { id: string; slug: string; cover_image_url: string | null }[]
  journalGallery: {
    image_url: string
    storage_path: string | null
    journal_entries: { id: string; slug: string } | null
  }[]
  /** Library videos on journal entries — referenced by asset id, not URL. */
  journalVideo?: { id: string; slug: string; video_asset_id: string | null }[]
  /** /magaza slider slides — media and poster, by asset id. */
  sliderSlides?: { id: string; media_asset_id: string; poster_asset_id: string | null }[]
}

const HREFS: Record<MediaUsageKind, (id: string) => string> = {
  product: (id) => `/admin/products/${id}`,
  producer: (id) => `/admin/producers/${id}`,
  journal: (id) => `/admin/journal/${id}`,
  slider: () => "/admin/content",
}

export function collateUsage(assets: readonly MediaAsset[], rows: UsageRows): Map<string, MediaUsage[]> {
  const byUrl = new Map<string, MediaUsage[]>()
  const byPath = new Map<string, MediaUsage[]>()
  const push = (map: Map<string, MediaUsage[]>, key: string | null | undefined, entry: MediaUsage) => {
    if (!key) return
    map.set(key, [...(map.get(key) ?? []), entry])
  }
  const usage = (kind: MediaUsageKind, id: string, name: string, isPrimary: boolean): MediaUsage => ({
    kind,
    id,
    name,
    href: HREFS[kind](id),
    isPrimary,
  })

  for (const row of rows.productGallery) {
    if (!row.products) continue
    const entry = usage("product", row.products.id, row.products.name, false)
    push(byUrl, row.image_url, entry)
    push(byPath, row.storage_path, entry)
  }
  for (const row of rows.productMain) push(byUrl, row.main_image_url, usage("product", row.id, row.name, true))

  for (const row of rows.producers) push(byUrl, row.photo_url, usage("producer", row.id, row.name, true))

  for (const row of rows.journalCover) push(byUrl, row.cover_image_url, usage("journal", row.id, row.slug, true))
  for (const row of rows.journalGallery) {
    if (!row.journal_entries) continue
    const entry = usage("journal", row.journal_entries.id, row.journal_entries.slug, false)
    push(byUrl, row.image_url, entry)
    push(byPath, row.storage_path, entry)
  }

  const byId = new Map<string, MediaUsage[]>()
  for (const row of rows.journalVideo ?? []) push(byId, row.video_asset_id, usage("journal", row.id, row.slug, false))
  for (const row of rows.sliderSlides ?? []) {
    const entry = usage("slider", row.id, "Mağaza slider'ı", false)
    push(byId, row.media_asset_id, entry)
    push(byId, row.poster_asset_id, entry)
  }

  const result = new Map<string, MediaUsage[]>()
  for (const asset of assets) {
    const merged = [
      ...(byUrl.get(asset.url) ?? []),
      ...(byPath.get(asset.objectPath) ?? []),
      ...(byId.get(asset.id) ?? []),
    ]
    // One record may reference the same asset as its primary image and in its
    // gallery, or by URL and by path: list it once, as primary if any say so.
    const collapsed = new Map<string, MediaUsage>()
    for (const entry of merged) {
      const key = `${entry.kind}:${entry.id}`
      const existing = collapsed.get(key)
      collapsed.set(key, { ...entry, isPrimary: (existing?.isPrimary ?? false) || entry.isPrimary })
    }
    result.set(asset.id, [...collapsed.values()])
  }
  return result
}

const KIND_PHRASES: Record<MediaUsageKind, string> = {
  product: "üründe",
  producer: "üreticide",
  journal: "günlük notunda",
  slider: "slider'da",
}

/** "1 üründe, 1 üreticide kullanılıyor" — or "Kullanılmıyor". */
export function summariseUsage(usage: readonly MediaUsage[]): string {
  if (usage.length === 0) return "Kullanılmıyor"
  const parts = (["product", "producer", "journal", "slider"] as const)
    .map((kind) => ({ kind, count: usage.filter((entry) => entry.kind === kind).length }))
    .filter((part) => part.count > 0)
    .map((part) => `${part.count} ${KIND_PHRASES[part.kind]}`)
  return `${parts.join(", ")} kullanılıyor`
}

const KIND_LABELS: Record<MediaUsageKind, string> = {
  product: "ürün",
  producer: "üretici",
  journal: "günlük notu",
  slider: "mağaza slider'ı",
}

/** The refusal shown when someone tries to delete an asset that is still in use. */
export function deleteBlockedMessage(usage: readonly MediaUsage[]): string {
  const names = usage.map((entry) => `${entry.name} (${KIND_LABELS[entry.kind]})`).join(", ")
  return `Bu dosya şu kayıtlarda kullanılıyor: ${names}. Önce bu kayıtlardan kaldırın, sonra silin.`
}
