import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8")

describe("content video migration", () => {
  const sql = read("20261117000000_content_video.sql")

  it("creates a public video bucket capped at 50 MB, mp4/webm only", () => {
    assert.match(sql, /'content-video'/)
    assert.match(sql, /52428800/)
    assert.match(sql, /'video\/mp4'/)
    assert.match(sql, /'video\/webm'/)
  })

  it("writes to the bucket only as an administrator", () => {
    assert.match(sql, /content_video_admin_insert[\s\S]*bucket_id = 'content-video' and public\.has_admin_role\(\)/)
  })

  it("lets media_assets catalogue video", () => {
    assert.match(sql, /media_assets_mime_allowed[\s\S]*'video\/mp4'/)
  })

  it("links a journal video to the library and never alongside a local path", () => {
    assert.match(sql, /video_asset_id\s+uuid[^,;]*references public\.media_assets \(id\) on delete restrict/)
    assert.match(sql, /journal_entries_one_video/)
    assert.match(sql, /video_path is null or video_asset_id is null/)
  })
})

describe("shop slider migration", () => {
  const sql = read("20261117000100_shop_slider.sql")

  it("has the three tables and the save RPC", () => {
    for (const name of ["shop_slider_config", "shop_slides", "shop_featured_products", "admin_save_shop_slider"]) {
      assert.match(sql, new RegExp(`public\\.${name}`))
    }
  })

  it("caps slides at 6 and featured products at 12", () => {
    assert.match(sql, /sort_order between 0 and 5/)
    assert.match(sql, /sort_order between 0 and 11/)
  })

  it("protects referenced media and re-derives admin rights in the RPC", () => {
    assert.match(sql, /media_asset_id\s+uuid\s+not null references public\.media_assets \(id\) on delete restrict/)
    assert.match(sql, /if not public\.has_admin_role\(\) then/)
  })

  it("carries the current banner over only into an empty slider", () => {
    assert.match(sql, /shop_banner_enabled/)
    assert.match(sql, /not exists \(select 1 from public\.shop_slides\)/)
  })
})

describe("both migrations are additive", () => {
  for (const name of ["20261117000000_content_video.sql", "20261117000100_shop_slider.sql"]) {
    it(`${name} drops and truncates nothing`, () => {
      const sql = read(name).replace(/^--.*$/gm, "")
      assert.doesNotMatch(sql, /drop table|truncate|drop column/i)
    })
  }
})
