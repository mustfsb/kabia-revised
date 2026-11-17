/**
 * Identifies a video from its first bytes — the video counterpart of
 * image-probe.ts. The declared type and the extension are claims; the header is
 * the evidence.
 *
 * MP4 (ISO base media): a box whose type at bytes 4–7 is `ftyp`.
 * WebM (Matroska/EBML): the EBML magic `1A 45 DF A3` at byte 0.
 *
 * Pure module so it can be tested directly.
 */

export type ProbedVideoFormat = "video/mp4" | "video/webm"

/** How many leading bytes the probe needs. */
export const VIDEO_PROBE_BYTES = 64

export function probeVideo(header: ArrayBuffer): ProbedVideoFormat | null {
  const b = new Uint8Array(header)
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "video/mp4"
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm"
  return null
}
