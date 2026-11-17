"use client"

import { useCallback, useState } from "react"
import { MediaPicker } from "@/components/admin/media/media-picker"
import { AdminButton } from "@/components/admin/ui/form"
import type { MediaFolder } from "@/lib/admin/media"

/**
 * One optional video, chosen from the library.
 *
 * A new video is uploaded from inside the picker (straight to Storage, see
 * upload-file.ts) and selected at once. An entry that still points at a legacy
 * local file shows it and can drop it, but a path can never be typed in: the
 * form submits only `video_asset_id` and whether to keep the legacy path.
 */
export function VideoField({
  initial,
  legacyPath,
  folder,
  error,
}: {
  initial: { id: string; url: string } | null
  legacyPath: string | null
  folder: MediaFolder
  error?: string
}) {
  const [video, setVideo] = useState(initial)
  const [keepLegacy, setKeepLegacy] = useState(Boolean(legacyPath))
  const [pickerOpen, setPickerOpen] = useState(false)
  const close = useCallback(() => setPickerOpen(false), [])

  return (
    <div className="space-y-3">
      <input type="hidden" name="video_asset_id" value={video?.id ?? ""} />
      <input type="hidden" name="keep_legacy_video" value={keepLegacy && !video ? "true" : "false"} />

      {video ? (
        <video
          src={video.url}
          controls
          muted
          playsInline
          preload="metadata"
          className="aspect-video w-full max-w-md rounded-[3px] bg-ink/[0.05]"
        />
      ) : legacyPath && keepLegacy ? (
        <p className="text-sm text-ink/70">
          Mevcut video: yerel dosya <span className="figure text-ink/50">({legacyPath})</span>
        </p>
      ) : (
        <p className="text-sm text-ink/55">Bu notun videosu yok.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <AdminButton variant="outline" onClick={() => setPickerOpen(true)}>
          {video || (legacyPath && keepLegacy) ? "Videoyu değiştir" : "Medyadan seç veya yükle"}
        </AdminButton>
        {(video || (legacyPath && keepLegacy)) && (
          <AdminButton
            variant="ghost"
            onClick={() => {
              setVideo(null)
              setKeepLegacy(false)
            }}
          >
            Kaldır
          </AdminButton>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-clay">
          {error}
        </p>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={close}
        onConfirm={(assets) => {
          const chosen = assets[0]
          if (chosen) setVideo({ id: chosen.id, url: chosen.url })
        }}
        multiple={false}
        kind="video"
        folder={folder}
        title="Video seç"
      />
    </div>
  )
}
