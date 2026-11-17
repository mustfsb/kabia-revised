import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// The storefront half of the slider. Rendering needs a browser, so these pin
// the contract in source: where the slider sits, that it autoplays on the agreed
// interval but stops for the reader (hover, focus, hidden tab, reduced motion,
// save-data video), that it is a labelled carousel, and that a featured product
// says so and states its discount.

const page = readFileSync("app/shop/page.tsx", "utf8")
const slider = readFileSync("components/shop/shop-slider.tsx", "utf8")
const productSlide = readFileSync("components/shop/slider-product-slide.tsx", "utf8")
const below = readFileSync("components/shop/featured-products.tsx", "utf8")
const entry = readFileSync("components/shop/product-entry.tsx", "utf8")

describe("/magaza slider placement", () => {
  it("reads the slider and no longer the single banner", () => {
    assert.match(page, /getShopSliderView\(\)/)
    assert.doesNotMatch(page, /ShopHeroBanner|shopBannerVisible/)
  })

  it("sits inside the listing's own wrap, so its edges line up with the grid", () => {
    assert.match(slider, /className="wrap/)
  })
})

describe("carousel behaviour", () => {
  it("advances on the agreed interval", () => {
    assert.match(slider, /SLIDER_INTERVAL_MS/)
    assert.match(slider, /setInterval|setTimeout/)
  })

  it("pauses for hover, focus, a hidden tab, and starts still for reduced motion", () => {
    assert.match(slider, /onMouseEnter/)
    assert.match(slider, /onFocus/)
    assert.match(slider, /visibilitychange/)
    assert.match(slider, /usePrefersReducedMotion/)
    assert.match(slider, /autoplayInitiallyOn/)
  })

  it("has one pause/play control and labelled arrows", () => {
    assert.match(slider, /aria-label=\{playing \? "Slider'ı durdur" : "Slider'ı başlat"\}/)
    assert.match(slider, /aria-label="Önceki slayt"/)
    assert.match(slider, /aria-label="Sonraki slayt"/)
  })

  it("is a labelled carousel with native swipe", () => {
    assert.match(slider, /aria-roledescription="carousel"/)
    assert.match(slider, /aria-roledescription="slide"/)
    assert.match(slider, /snap-mandatory/)
  })

  it("plays only the active video, and not on save-data", () => {
    assert.match(slider, /saveData/)
    assert.match(slider, /\.pause\(\)/)
    assert.match(slider, /muted/)
  })
})

describe("featured products", () => {
  it("a product slide says it is featured and states the discount", () => {
    assert.match(productSlide, /Öne çıkan/)
    assert.match(productSlide, /discountPercent/)
    assert.match(productSlide, /line-through/)
  })

  it("the cards under a media slider are the shop's own entries, marked featured", () => {
    assert.match(below, /<ProductEntry[^>]*featured/)
    assert.match(below, /Öne çıkanlar/)
  })

  it("a shop card can say featured, and states a discount as a percent", () => {
    assert.match(entry, /featured\?: boolean/)
    assert.match(entry, /Öne çıkan/)
    assert.match(entry, /discountPercent\(/)
    assert.match(entry, /% ?\{?.*indirim|indirim/)
  })
})

describe("slider overlay in dark mode", () => {
  const css = readFileSync("app/globals.css", "utf8")

  it("the scrim and the counter use fixed dark tones, not the ink token that turns light in dark mode", () => {
    assert.doesNotMatch(slider, /from-ink\/|via-ink\/|bg-ink\//)
    assert.match(slider, /from-black\//)
  })

  it("the slide button hovers to green with white text in dark mode, never to the dark surface", () => {
    assert.match(slider, /slider-cta/)
    for (const scope of [/:root:not\(\[data-theme="light"\]\) \.slider-cta:hover/, /:root\[data-theme="dark"\] \.slider-cta:hover/]) {
      const at = css.search(scope)
      assert.ok(at >= 0, String(scope))
      const rule = css.slice(at, css.indexOf("}", at))
      assert.match(rule, /background-color: #1e7a4e/)
      assert.match(rule, /color: #fff/)
    }
  })
})
