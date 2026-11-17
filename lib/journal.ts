import { honestCache } from "@/lib/honest-cache"
import { publicMediaUrl } from "@/lib/admin/media"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Kabia's field journal: dated notes from the orchard — location, weather,
 * orchard state, what was applied, what was observed, what came of it.
 *
 * The entries live in `journal_entries` (with an ordered `journal_entry_images`
 * gallery) and are managed from /admin/journal. `content/journal.ts` used to
 * hold them; the shape below is deliberately the same one the pages always
 * consumed, with `photo` and `video` kept as they were.
 *
 * `photo` is the entry's cover image. `gallery` is every image in display order,
 * the cover included, exactly like a product's gallery includes its main image.
 * `video` is a library video (content-video bucket) or, for older entries, a
 * local path.
 */

export interface JournalImage {
  url: string
  altText: string | null
  sortOrder: number
}

export interface JournalEntry {
  id: string
  slug: string
  /** ISO date, e.g. "2026-03-14". */
  date: string
  location: string
  weather: string
  orchardState: string
  application: string
  observation: string
  outcome: string
  /** The cover image, when the entry has one. */
  photo?: string
  /** Optional video path, e.g. "/images/gunluk-2026-03-15-kaolin.mp4". */
  video?: string
  gallery: JournalImage[]
}

export interface JournalEntryRow {
  id: string
  slug: string
  entry_date: string
  location: string
  weather: string
  orchard_state: string
  application: string
  observation: string
  outcome: string
  cover_image_url: string | null
  video_path: string | null
  video_bucket?: string | null
  video_object_path?: string | null
  journal_entry_images?: { image_url: string; alt_text: string | null; sort_order: number }[] | null
}

const JOURNAL_SELECT =
  "id, slug, entry_date, location, weather, orchard_state, application, observation, outcome, cover_image_url, video_path, video_bucket, video_object_path, journal_entry_images(image_url, alt_text, sort_order)"

/** The journal is a handful of notes a season; this is a ceiling, not a page size. */
const JOURNAL_LIMIT = 500

/**
 * A library video's URL is derived from bucket + path (the row carries the copy
 * the database trigger keeps), never stored. Without a Supabase URL there is no
 * honest URL to give, so the video is left out rather than rendered broken.
 */
function videoUrl(row: JournalEntryRow, supabaseUrl: string): string | undefined {
  if (row.video_bucket && row.video_object_path) {
    return supabaseUrl ? publicMediaUrl(supabaseUrl, row.video_bucket, row.video_object_path) : undefined
  }
  return row.video_path ?? undefined
}

export function mapJournalEntry(
  row: JournalEntryRow,
  supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
): JournalEntry {
  const video = videoUrl(row, supabaseUrl)
  const gallery: JournalImage[] = (row.journal_entry_images ?? [])
    .map((image) => ({ url: image.image_url, altText: image.alt_text, sortOrder: image.sort_order }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const photo = row.cover_image_url ?? gallery[0]?.url
  return {
    id: row.id,
    slug: row.slug,
    date: row.entry_date,
    location: row.location,
    weather: row.weather,
    orchardState: row.orchard_state,
    application: row.application,
    observation: row.observation,
    outcome: row.outcome,
    ...(photo ? { photo } : {}),
    ...(video ? { video } : {}),
    gallery,
  }
}

export type PublicJournalResult =
  | { status: "ok"; entries: JournalEntry[] }
  | { status: "error" }

/**
 * Every published entry, newest first — the same is_published gate the RLS
 * policy enforces.
 *
 * Returns a tagged result for the reason the producer and catalogue reads do:
 * "nothing has been published yet" and "the journal could not be read" are
 * different facts, and only one of them is something to tell a visitor.
 */
export async function fetchPublishedJournal(client: SupabaseClient): Promise<PublicJournalResult> {
  const { data, error } = await client
    .from("journal_entries")
    .select(JOURNAL_SELECT)
    .eq("is_published", true)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(JOURNAL_LIMIT)

  if (error || !data) return { status: "error" }
  return { status: "ok", entries: (data as unknown as JournalEntryRow[]).map((row) => mapJournalEntry(row)) }
}

/** The entries either side of `slug` in date order (input order is irrelevant). */
export function journalNeighbours(
  entries: readonly Pick<JournalEntry, "slug" | "date">[],
  slug: string,
): { previous?: (typeof entries)[number]; next?: (typeof entries)[number] } {
  const byDate = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug))
  const index = byDate.findIndex((entry) => entry.slug === slug)
  if (index === -1) return { previous: undefined, next: undefined }
  return { previous: byDate[index - 1], next: byDate[index + 1] }
}

/**
 * Storefront journal cache. Same contract as the direct read (honest error
 * state included), refreshed every 5 minutes through the shared anon client.
 * Journal mutations bust the tag with updateTag, so an edit is visible on the
 * next request. A failed read is never cached (see lib/honest-cache.ts).
 */
export const JOURNAL_TAG = "journal-entries"

export const getCachedPublishedJournal = honestCache(
  "public journal",
  fetchPublishedJournal,
  (result: PublicJournalResult) => result.status === "error",
  { status: "error" } as PublicJournalResult,
  ["kabia-public-journal-v1"],
  { revalidate: 300, tags: [JOURNAL_TAG] },
)
