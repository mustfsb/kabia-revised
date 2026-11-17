import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isVideoMime,
  safeObjectName,
  VIDEO_BUCKET,
  VIDEO_EXTENSIONS,
  VIDEO_MAX_BYTES,
  type MediaFolder,
} from "@/lib/admin/media"
import type { MediaUploadResult } from "@/lib/admin/media-upload"
import { toAsset, type MediaRow } from "@/lib/admin/queries/media"
import { probeVideo, VIDEO_PROBE_BYTES } from "@/lib/admin/video-probe"

/**
 * Video uploads, in two halves around a browser-to-Storage transfer.
 *
 * A video does not fit through the app (Vercel refuses request bodies over
 * 4.5 MB), so the server never sees the bytes in transit:
 *
 *   1. prepareVideoUpload — after the caller has checked the administrator,
 *      checks the declared type and size and mints the object name and a
 *      signed upload URL through the administrator's own session (the bucket's
 *      admin insert policy authorises it; no service-role key).
 *   2. the browser uploads to that URL;
 *   3. finalizeVideoUpload — reads the stored object's real size and first
 *      bytes, and only then catalogues it. Anything that is not a video, is too
 *      large, or disagrees with its extension is removed again.
 *
 * Taking the client (and the header fetch) as arguments keeps both halves
 * testable without a session or a network.
 */

export type VideoPrepareResult =
  | { ok: true; path: string; token: string }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "failed"; error: unknown; context: string }

const ASSET_COLUMNS =
  "id, bucket_id, object_path, original_filename, display_name, mime_type, file_size, width, height, alt_text, created_at, created_by"

/** Only names prepareVideoUpload can mint: [journal|slider/]YYYY-MM/<stem>-<8 hex>.<mp4|webm>. */
const VIDEO_PATH = /^(?:(?:journal|slider)\/)?\d{4}-\d{2}\/[a-z0-9-]+-[0-9a-f]{8}\.(mp4|webm)$/

const NOT_A_VIDEO = "Dosya içeriği geçerli bir video değil. Yalnızca MP4 ve WebM kabul edilir."

export async function prepareVideoUpload(
  supabase: SupabaseClient,
  input: { filename: string; size: number; type: string; folder: MediaFolder | null },
): Promise<VideoPrepareResult> {
  if (!isVideoMime(input.type)) {
    return { ok: false, kind: "invalid", message: "Yalnızca MP4 ve WebM videoları yüklenebilir." }
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, kind: "invalid", message: "Yüklenecek dosya boş." }
  }
  if (input.size > VIDEO_MAX_BYTES) {
    return { ok: false, kind: "invalid", message: "Video 50 MB sınırını aşıyor. Videoyu sıkıştırıp yeniden yükleyin." }
  }

  const path = safeObjectName(input.filename, input.type, input.folder)
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, kind: "failed", error: error ?? new Error("no signed url"), context: "videoUpload:sign" }
  return { ok: true, path, token: data.token }
}

/** Fetches the first bytes of a public object. Injected so tests need no network. */
export type FetchHead = (url: string) => Promise<ArrayBuffer>

export const fetchObjectHead: FetchHead = async (url) => {
  const response = await fetch(url, { headers: { Range: `bytes=0-${VIDEO_PROBE_BYTES - 1}` }, cache: "no-store" })
  if (!response.ok) throw new Error(`head fetch ${response.status}`)
  return (await response.arrayBuffer()).slice(0, VIDEO_PROBE_BYTES)
}

export async function finalizeVideoUpload(
  supabase: SupabaseClient,
  input: { path: string; filename: string; userId: string; fetchHead?: FetchHead },
): Promise<MediaUploadResult> {
  const { path, filename, userId, fetchHead = fetchObjectHead } = input
  const match = VIDEO_PATH.exec(path)
  if (!match) return { ok: false, kind: "invalid", message: "Geçersiz yükleme." }

  const bucket = supabase.storage.from(VIDEO_BUCKET)

  // A second finalize of the same object must never remove a file the library
  // already holds (and that a slide or journal entry may already show).
  const { data: existing, error: existingError } = await supabase
    .from("media_assets")
    .select("id")
    .eq("bucket_id", VIDEO_BUCKET)
    .eq("object_path", path)
    .maybeSingle()
  if (existingError) return { ok: false, kind: "failed", error: existingError, context: "videoUpload:existing" }
  if (existing) return { ok: false, kind: "invalid", message: "Bu video zaten kütüphanede." }

  const reject = async (message: string): Promise<MediaUploadResult> => {
    await bucket.remove([path])
    return { ok: false, kind: "invalid", message }
  }

  const { data: info, error: infoError } = await bucket.info(path)
  if (infoError || !info) return { ok: false, kind: "failed", error: infoError ?? new Error("no object"), context: "videoUpload:info" }
  const size = Number(info.size)
  if (!Number.isFinite(size) || size <= 0) return reject("Yüklenen dosya boş.")
  if (size > VIDEO_MAX_BYTES) return reject("Video 50 MB sınırını aşıyor. Videoyu sıkıştırıp yeniden yükleyin.")

  const {
    data: { publicUrl },
  } = bucket.getPublicUrl(path)

  let probed
  try {
    probed = probeVideo(await fetchHead(publicUrl))
  } catch (error) {
    return { ok: false, kind: "failed", error, context: "videoUpload:head" }
  }
  if (!probed) return reject(NOT_A_VIDEO)
  if (VIDEO_EXTENSIONS[probed] !== match[1]) {
    return reject(`Dosya türü içeriğiyle uyuşmuyor (gerçek içerik: ${probed}). Dosyayı doğru biçimde yeniden kaydedin.`)
  }

  const { data: row, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      bucket_id: VIDEO_BUCKET,
      object_path: path,
      original_filename: filename.slice(0, 200) || path,
      mime_type: probed,
      file_size: size,
      width: null,
      height: null,
      created_by: userId,
    })
    .select(ASSET_COLUMNS)
    .single()

  if (insertError || !row) {
    await bucket.remove([path])
    return { ok: false, kind: "failed", error: insertError ?? new Error("media row missing"), context: "videoUpload:catalogue" }
  }

  return { ok: true, asset: toAsset(row as unknown as MediaRow, publicUrl, null), path, url: publicUrl }
}
