import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { finalizeVideoUpload, prepareVideoUpload } from "@/lib/admin/video-upload"

// Video goes browser → Storage with a signed URL, then the server proves the
// bytes are a video before the library learns about it. These pin: the size and
// type gate before a URL is issued, the path shape a finalize accepts, that a
// fake video is removed rather than catalogued, and that a second finalize of
// the same object never deletes a file the library already holds.

const MP4_HEAD = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]).buffer
const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer
const PATH = "slider/2026-11/hasat-abcdef12.mp4"

function fakeSupabase(opts: { size?: number; existing?: boolean; insertError?: unknown } = {}) {
  const log = {
    signed: [] as { bucket: string; path: string }[],
    removes: [] as { bucket: string; paths: string[] }[],
    inserts: [] as Record<string, unknown>[],
  }
  const client = {
    storage: {
      from(bucket: string) {
        return {
          createSignedUploadUrl: async (path: string) => {
            log.signed.push({ bucket, path })
            return { data: { path, token: "tok", signedUrl: "https://x/sign" }, error: null }
          },
          info: async () => ({ data: { size: opts.size ?? 1024, contentType: "video/mp4" }, error: null }),
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}` },
          }),
          remove: async (paths: string[]) => {
            log.removes.push({ bucket, paths })
            return { error: null }
          },
        }
      },
    },
    from() {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: opts.existing ? { id: "old" } : null, error: null }) }),
          }),
        }),
        insert(row: Record<string, unknown>) {
          log.inserts.push(row)
          return {
            select: () => ({
              single: async () =>
                opts.insertError
                  ? { data: null, error: opts.insertError }
                  : { data: { id: "vid-1", display_name: null, alt_text: null, width: null, height: null, created_at: "2026-11-17T10:00:00Z", ...row }, error: null },
            }),
          }
        },
      }
    },
  }
  return { client: client as never, log }
}

describe("prepareVideoUpload", () => {
  it("issues a signed URL in content-video under the folder", async () => {
    const { client, log } = fakeSupabase()
    const result = await prepareVideoUpload(client, { filename: "Hasat.mp4", size: 5_000_000, type: "video/mp4", folder: "slider" })
    assert.equal(result.ok, true)
    assert.equal(log.signed[0].bucket, "content-video")
    assert.match(log.signed[0].path, /^slider\/\d{4}-\d{2}\/hasat-[0-9a-f]{8}\.mp4$/)
  })

  it("refuses a video over 50 MB before any URL is issued", async () => {
    const { client, log } = fakeSupabase()
    const result = await prepareVideoUpload(client, { filename: "a.mp4", size: 60 * 1024 * 1024, type: "video/mp4", folder: null })
    assert.equal(result.ok, false)
    assert.equal(log.signed.length, 0)
  })

  it("refuses a non-video type", async () => {
    const { client } = fakeSupabase()
    const result = await prepareVideoUpload(client, { filename: "a.png", size: 100, type: "image/png", folder: null })
    assert.ok(!result.ok && result.kind === "invalid")
  })
})

describe("finalizeVideoUpload", () => {
  it("catalogues a real MP4 in content-video", async () => {
    const { client, log } = fakeSupabase({ size: 2048 })
    const result = await finalizeVideoUpload(client, { path: PATH, filename: "Hasat.mp4", userId: "u1", fetchHead: async () => MP4_HEAD })
    assert.equal(result.ok, true)
    assert.equal(log.inserts[0].bucket_id, "content-video")
    assert.equal(log.inserts[0].mime_type, "video/mp4")
    assert.equal(log.inserts[0].file_size, 2048)
    assert.equal(log.removes.length, 0)
  })

  it("removes and refuses a file whose bytes are not a video", async () => {
    const { client, log } = fakeSupabase()
    const result = await finalizeVideoUpload(client, { path: PATH, filename: "a.mp4", userId: "u1", fetchHead: async () => PNG_HEAD })
    assert.ok(!result.ok && result.kind === "invalid")
    assert.match(!result.ok && result.kind === "invalid" ? result.message : "", /geçerli bir video değil/)
    assert.deepEqual(log.removes, [{ bucket: "content-video", paths: [PATH] }])
    assert.equal(log.inserts.length, 0)
  })

  it("refuses a path the server did not mint", async () => {
    for (const path of ["../product-media/x.mp4", "slider/2026-11/x.mp4", "products/2026-11/a-abcdef12.mp4"]) {
      const { client, log } = fakeSupabase()
      const result = await finalizeVideoUpload(client, { path, filename: "a.mp4", userId: "u1", fetchHead: async () => MP4_HEAD })
      assert.equal(result.ok, false, path)
      assert.equal(log.removes.length, 0, path)
    }
  })

  it("never deletes an object the library already catalogues", async () => {
    const { client, log } = fakeSupabase({ existing: true })
    const result = await finalizeVideoUpload(client, { path: PATH, filename: "a.mp4", userId: "u1", fetchHead: async () => MP4_HEAD })
    assert.equal(result.ok, false)
    assert.equal(log.removes.length, 0)
    assert.equal(log.inserts.length, 0)
  })

  it("removes and refuses an object over 50 MB", async () => {
    const { client, log } = fakeSupabase({ size: 51 * 1024 * 1024 })
    const result = await finalizeVideoUpload(client, { path: PATH, filename: "a.mp4", userId: "u1", fetchHead: async () => MP4_HEAD })
    assert.equal(result.ok, false)
    assert.equal(log.removes.length, 1)
  })

  it("refuses an extension that disagrees with the bytes", async () => {
    const webmHead = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]).buffer
    const { client, log } = fakeSupabase()
    const result = await finalizeVideoUpload(client, { path: PATH, filename: "a.mp4", userId: "u1", fetchHead: async () => webmHead })
    assert.equal(result.ok, false)
    assert.equal(log.removes.length, 1)
  })
})
