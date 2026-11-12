import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// WAI-APG tabs on the product page: arrow keys move between tabs and
// activate as they go, Home/End jump to the ends, and only the active
// tab sits in the tab order.

describe("product tabs keyboard navigation", () => {
  const src = readFileSync("components/shop/product-detail-islands.tsx", "utf8")

  it("moves with arrows and jumps with Home/End", () => {
    assert.match(src, /onTabKeyDown/)
    assert.match(src, /event\.key === "ArrowRight"/)
    assert.match(src, /event\.key === "ArrowLeft"/)
    assert.match(src, /event\.key === "Home"/)
    assert.match(src, /event\.key === "End"/)
  })

  it("keeps only the active tab in the tab order and focuses as it activates", () => {
    assert.match(src, /tabIndex=\{active \? 0 : -1\}/)
    assert.match(src, /tabRefs\.current\[next]\?\.focus\(\)/)
  })

  it("sold-out weights announce themselves", () => {
    const purchase = readFileSync("components/shop/product-purchase.tsx", "utf8")
    assert.match(purchase, /aria-label=\{sold \? `\$\{v\.weight\} — tükendi` : undefined\}/)
  })
})
