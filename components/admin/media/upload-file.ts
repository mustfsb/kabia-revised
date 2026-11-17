"use client"

import {
  createVideoUploadAction,
  finalizeVideoUploadAction,
  uploadMediaAction,
} from "@/app/admin/(protected)/media/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import {
  clientFileProblem,
  isVideoMime,
  MEDIA_CACHE_CONTROL,
  VIDEO_BUCKET,
  type MediaAsset,
  type MediaFolder,
} from "@/lib/admin/media"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type UploadOutcome = { ok: true; asset: MediaAsset } | { ok: false; message: string }

/**
 * One file into the library, whatever it is.
 *
 * Images keep their path through the server action (≤ 4 MB, probed and sized on
 * the server). Videos go to Storage directly with a signed URL minted by the
 * server, then come back to the server to be probed and catalogued — the file
 * itself never passes through the app.
 */
export async function uploadLibraryFile(file: File, folder?: MediaFolder | null): Promise<UploadOutcome> {
  const video = isVideoMime(file.type)
  const problem = clientFileProblem(file, video ? "video" : "image")
  if (problem) return { ok: false, message: problem }

  if (!video) {
    const data = new FormData()
    data.set("file", file)
    if (folder) data.set("folder", folder)
    const result = await uploadMediaAction(ACTION_IDLE, data)
    return result.ok && result.asset
      ? { ok: true, asset: result.asset }
      : { ok: false, message: result.message ?? "Yükleme başarısız." }
  }

  const ticket = await createVideoUploadAction({ filename: file.name, size: file.size, type: file.type, folder: folder ?? null })
  if (!ticket.ok) return { ok: false, message: ticket.message }

  const supabase = await getSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, cacheControl: MEDIA_CACHE_CONTROL })
  if (error) return { ok: false, message: "Video yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin." }

  const result = await finalizeVideoUploadAction({ path: ticket.path, filename: file.name })
  return result.ok && result.asset
    ? { ok: true, asset: result.asset }
    : { ok: false, message: result.message ?? "Video kaydedilemedi." }
}
