import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { probeVideo, VIDEO_PROBE_BYTES } from "@/lib/admin/video-probe"
import {
  clientFileProblem,
  isVideoMime,
  mediaKindOf,
  MEDIA_FOLDERS,
  safeObjectName,
  VIDEO_ACCEPT,
  VIDEO_BUCKET,
  VIDEO_MAX_BYTES,
} from "@/lib/admin/media"

const bytes = (...values: number[]) => new Uint8Array(values).buffer

// size(4) "ftyp" "isom"
const MP4 = bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d)
const WEBM = bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

describe("probeVideo", () => {
  it("recognises an MP4 by its ftyp box", () => assert.equal(probeVideo(MP4), "video/mp4"))
  it("recognises a WebM by its EBML header", () => assert.equal(probeVideo(WEBM), "video/webm"))
  it("rejects an image renamed to .mp4", () => assert.equal(probeVideo(PNG), null))
  it("rejects an empty file", () => assert.equal(probeVideo(new ArrayBuffer(0)), null))
  it("reads only a small header", () => assert.ok(VIDEO_PROBE_BYTES <= 64))
})

describe("video constants", () => {
  it("is a 50 MB mp4/webm bucket, matching the migration", () => {
    assert.equal(VIDEO_BUCKET, "content-video")
    assert.equal(VIDEO_MAX_BYTES, 50 * 1024 * 1024)
    assert.equal(VIDEO_ACCEPT, "video/mp4,video/webm")
    const sql = readFileSync("supabase/migrations/20261117000000_content_video.sql", "utf8")
    assert.match(sql, new RegExp(`'${VIDEO_BUCKET}', true, ${VIDEO_MAX_BYTES}`))
  })

  it("classifies MIME types", () => {
    assert.equal(isVideoMime("video/webm"), true)
    assert.equal(isVideoMime("image/png"), false)
    assert.equal(mediaKindOf("video/mp4"), "video")
    assert.equal(mediaKindOf("image/avif"), "image")
  })

  it("files slider uploads under slider/ with the video extension", () => {
    assert.ok((MEDIA_FOLDERS as readonly string[]).includes("slider"))
    assert.match(safeObjectName("Hasat Günü.MOV.mp4", "video/mp4", "slider"), /^slider\/\d{4}-\d{2}\/hasat-g-n-mov-[0-9a-f]{8}\.mp4$/)
  })
})

describe("clientFileProblem for video", () => {
  it("accepts a 10 MB mp4", () => {
    assert.equal(clientFileProblem({ name: "a.mp4", size: 10 * 1024 * 1024, type: "video/mp4" }, "video"), null)
  })
  it("refuses a video over 50 MB", () => {
    assert.match(clientFileProblem({ name: "a.mp4", size: 60 * 1024 * 1024, type: "video/mp4" }, "video") ?? "", /50 MB/)
  })
  it("refuses an image where a video is expected", () => {
    assert.match(clientFileProblem({ name: "a.png", size: 100, type: "image/png" }, "video") ?? "", /MP4 ve WebM/)
  })
  it("keeps the 4 MB image rule by default", () => {
    assert.match(clientFileProblem({ name: "a.jpg", size: 5 * 1024 * 1024, type: "image/jpeg" }) ?? "", /4 MB/)
  })
})
