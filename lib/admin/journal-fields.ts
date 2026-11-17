import type { JournalEntryInput } from "@/lib/admin/schemas"

/**
 * The journal editor's column contract, in one place — the same invariant as
 * lib/admin/producer-fields.ts: a field has to exist in four places to work (the
 * form renders it, the Zod schema keeps it, the save payload writes it, the
 * detail select reads it back).
 *
 * Two columns are deliberately *not* here:
 *   - `cover_image_url` is written together with the gallery by
 *     admin_save_journal_images, in one transaction, so the cover and the
 *     gallery can never disagree;
 *   - `slug` is written on insert only. It is the public URL and the database
 *     refuses to change it (guard_journal_entries_immutable), so an update never
 *     sends it.
 *
 * Pure module: no Supabase, no Next, no `server-only`, so it is testable.
 */

/** Every column an insert writes. */
export const JOURNAL_WRITE_COLUMNS = [
  "slug",
  "entry_date",
  "location",
  "weather",
  "orchard_state",
  "application",
  "observation",
  "outcome",
  "video_path",
  "video_asset_id",
  "is_published",
] as const

export type JournalWriteColumn = (typeof JOURNAL_WRITE_COLUMNS)[number]
export type JournalRowWrite = Record<JournalWriteColumn, unknown>

/**
 * `legacyVideoPath` is the local path the entry already has (null for a new
 * entry). It survives only while no library video is chosen and the form asked
 * to keep it — so a path can be kept or removed, never introduced.
 */
export function buildJournalRow(input: JournalEntryInput, legacyVideoPath: string | null = null): JournalRowWrite {
  return {
    slug: input.slug,
    entry_date: input.entry_date,
    location: input.location,
    weather: input.weather,
    orchard_state: input.orchard_state,
    application: input.application,
    observation: input.observation,
    outcome: input.outcome,
    video_path: input.video_asset_id || !input.keep_legacy_video ? null : legacyVideoPath,
    video_asset_id: input.video_asset_id,
    is_published: input.is_published,
  }
}

/** The row an UPDATE writes: everything but the slug, which never changes. */
export function buildJournalUpdateRow(
  input: JournalEntryInput,
  legacyVideoPath: string | null = null,
): Omit<JournalRowWrite, "slug"> {
  return Object.fromEntries(
    Object.entries(buildJournalRow(input, legacyVideoPath)).filter(([column]) => column !== "slug"),
  ) as Omit<JournalRowWrite, "slug">
}
