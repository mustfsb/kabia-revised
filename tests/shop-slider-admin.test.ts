import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// The slider is administered from /admin/content. These pin the boundary: who
// may save, that the save goes through the one transactional RPC and the
// shared schema, that the storefront cache is refreshed, and that the single
// banner form it replaces is gone.

const page = readFileSync("app/admin/(protected)/content/page.tsx", "utf8")
const actions = readFileSync("app/admin/(protected)/content/slider-actions.ts", "utf8")
const editor = readFileSync("components/admin/content/shop-slider-editor.tsx", "utf8")

describe("slider admin", () => {
  it("replaces the old banner form on the content page", () => {
    assert.doesNotMatch(page, /group="shop_banner"/)
    assert.match(page, /<ShopSliderEditor/)
    assert.match(page, /loadShopSliderAdmin\(supabase\)/)
  })

  it("saves through the content permission, the shared schema and the RPC", () => {
    assert.match(actions, /^"use server"/)
    assert.match(actions, /adminContext\("manageContent"\)/)
    assert.match(actions, /shopSliderSaveSchema\.safeParse/)
    assert.match(actions, /\.rpc\("admin_save_shop_slider"/)
    assert.match(actions, /logAdminAction/)
  })

  it("refreshes the storefront after a save", () => {
    assert.match(actions, /(updateTag|revalidateTag)\(SHOP_SLIDER_TAG/)
    assert.match(actions, /revalidatePath\("\/magaza"\)/)
  })

  it("picks slide media of either kind, posters as images only", () => {
    assert.match(editor, /kind="any"/)
    assert.match(editor, /kind="image"/)
    assert.match(editor, /folder="slider"/)
    assert.match(editor, /SLIDER_MAX_SLIDES/)
    assert.match(editor, /SLIDER_MAX_FEATURED/)
  })
})
