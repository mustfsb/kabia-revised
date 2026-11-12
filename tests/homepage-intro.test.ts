import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SETTINGS_FALLBACK } from "@/lib/settings";

// §8.2: administered intro products, seeded identical to the curated section.

describe("homepage intro settings", () => {
  it("migration seeds the three keys to the curated slugs", () => {
    const src = readFileSync("supabase/migrations/20260926001800_homepage_intro_settings.sql", "utf8");
    assert.match(src, /'intro_product_ciftlik',\s+'"kabuklu-badem"'/);
    assert.match(src, /'intro_product_secki',\s+'"findik-ici"'/);
    assert.match(src, /'intro_product_mutfak',\s+'"tarhana"'/);
    assert.match(src, /on conflict \(key\) do nothing/);
  });

  it("fallbacks keep the curated slugs when settings are unset", () => {
    assert.equal(SETTINGS_FALLBACK.introProductCiftlik, "kabuklu-badem");
    assert.equal(SETTINGS_FALLBACK.introProductSecki, "findik-ici");
    assert.equal(SETTINGS_FALLBACK.introProductMutfak, "tarhana");
  });

  it("collection resolves administered slugs with curated fallback", () => {
    const src = readFileSync("components/home/product-collection.tsx", "utf8");
    assert.match(src, /settings\.introProductCiftlik/);
    assert.match(src, /row\.is_active/);
    assert.match(src, /return \{ \.\.\.entry \};/);
  });

  it("admin control offers active products per line", () => {
    const src = readFileSync("components/admin/content/intro-products-form.tsx", "utf8");
    assert.match(src, /name="group" value="content"/);
    assert.match(src, /intro_product_ciftlik/);
    assert.match(src, /intro_product_secki/);
    assert.match(src, /intro_product_mutfak/);
    assert.match(src, /\.filter\(\(p\) => p\.isActive\)/);
    const page = readFileSync("app/admin/(protected)/content/page.tsx", "utf8");
    assert.match(page, /<IntroProductsForm/);
  });
});

describe("homepage hero footage restraint", () => {
  it("data-saving devices get the still, never the download", () => {
    const src = readFileSync("components/home/intro-sequence.tsx", "utf8");
    assert.match(src, /connection\?\.saveData === true/);
    assert.match(src, /if \(saveData\) \{/);
  });

  it("full-height stages track the dynamic viewport", () => {
    const intro = readFileSync("components/home/intro-sequence.tsx", "utf8");
    assert.match(intro, /sticky top-0 h-dvh overflow-hidden/);
    assert.ok(!intro.includes("h-screen"), "no static viewport stage left");
    const editorial = readFileSync("components/home/editorial-image.tsx", "utf8");
    assert.match(editorial, /h-\[64dvh\]/);
    assert.match(editorial, /md:h-\[82dvh\]/);
  });

  it("notify e-mail field stays at iOS no-zoom size", () => {
    const src = readFileSync("components/home/notify-form.tsx", "utf8");
    assert.match(src, /px-5 text-base text-ink placeholder:text-ink\/40/);
  });
});
