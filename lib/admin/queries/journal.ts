import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"
import { galleryFromRows, type GalleryState, type SavedImageRow } from "@/lib/admin/gallery"

/**
 * Journal list and detail reads for the admin screen.
 *
 * Everything runs through the administrator's own client, so RLS decides what
 * comes back (unpublished entries are visible to administrators only). Errors
 * degrade to empty states rather than throwing, the convention of the other
 * entity screens; deletion is decided by the database's own policy, not by
 * anything read here.
 */

export interface JournalListRow {
  id: string
  slug: string
  entryDate: string
  location: string
  observation: string
  isPublished: boolean
  hasVideo: boolean
  imageCount: number
}

export async function loadJournalList(supabase: SupabaseClient): Promise<JournalListRow[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, slug, entry_date, location, observation, is_published, video_path, video_asset_id, journal_entry_images(count)")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    logQueryError("journal:list", error)
    return []
  }

  type Row = {
    id: string
    slug: string
    entry_date: string
    location: string
    observation: string
    is_published: boolean
    video_path: string | null
    video_asset_id: string | null
    journal_entry_images: { count: number }[] | null
  }

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    entryDate: row.entry_date,
    location: row.location,
    observation: row.observation,
    isPublished: row.is_published,
    hasVideo: Boolean(row.video_path || row.video_asset_id),
    imageCount: row.journal_entry_images?.[0]?.count ?? 0,
  }))
}

export interface JournalDetail {
  id: string
  slug: string
  entryDate: string
  location: string
  weather: string
  orchardState: string
  application: string
  observation: string
  outcome: string
  /** Legacy local path (public/), kept for entries that predate library video. */
  videoPath: string | null
  /** The library video, if one is chosen. */
  video: { id: string; url: string } | null
  isPublished: boolean
  coverImageUrl: string | null
  gallery: GalleryState
  updatedAt: string
}

const DETAIL_SELECT =
  "id, slug, entry_date, location, weather, orchard_state, application, observation, outcome, video_path, video_asset_id, video_bucket, video_object_path, is_published, cover_image_url, updated_at, journal_entry_images(id, image_url, alt_text, sort_order, storage_path)"

export async function loadJournalDetail(supabase: SupabaseClient, entryId: string): Promise<JournalDetail | null> {
  const { data, error } = await supabase.from("journal_entries").select(DETAIL_SELECT).eq("id", entryId).maybeSingle()

  if (error) {
    logQueryError("journal:detail", error)
    return null
  }
  if (!data) return null

  type Raw = {
    id: string
    slug: string
    entry_date: string
    location: string
    weather: string
    orchard_state: string
    application: string
    observation: string
    outcome: string
    video_path: string | null
    video_asset_id: string | null
    video_bucket: string | null
    video_object_path: string | null
    is_published: boolean
    cover_image_url: string | null
    updated_at: string
    journal_entry_images:
      | { id: string; image_url: string; alt_text: string | null; sort_order: number; storage_path: string | null }[]
      | null
  }
  const row = data as unknown as Raw

  const images: SavedImageRow[] = (row.journal_entry_images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      id: image.id,
      imageUrl: image.image_url,
      altText: image.alt_text,
      storagePath: image.storage_path,
    }))

  return {
    id: row.id,
    slug: row.slug,
    entryDate: row.entry_date,
    location: row.location,
    weather: row.weather,
    orchardState: row.orchard_state,
    application: row.application,
    observation: row.observation,
    outcome: row.outcome,
    videoPath: row.video_path,
    video:
      row.video_asset_id && row.video_bucket && row.video_object_path
        ? {
            id: row.video_asset_id,
            url: supabase.storage.from(row.video_bucket).getPublicUrl(row.video_object_path).data.publicUrl,
          }
        : null,
    isPublished: row.is_published,
    coverImageUrl: row.cover_image_url,
    gallery: galleryFromRows(images, row.cover_image_url ?? images[0]?.imageUrl ?? ""),
    updatedAt: row.updated_at,
  }
}
