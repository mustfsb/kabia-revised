import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { pickIntroSlugPerSource } from "../lib/homepage-intro.ts"

/**
 * The homepage introduces one product per source. Which product that is has to
 * be an administrator's decision rather than three slugs compiled into
 * content/homepage.ts, because those slugs can be renamed or archived in the
 * dashboard with nothing to catch it.
 */

const candidate = (over: Partial<Parameters<typeof pickIntroSlugPerSource>[0][number]> = {}) => ({
  slug: "kabuklu-badem",
  source: "ciftlik" as const,
  isActive: true,
  isFeatured: true,
  displayOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
})

describe("homepage introduction selection", () => {
  it("introduces the featured product of each source", () => {
    const chosen = pickIntroSlugPerSource([
      candidate({ slug: "kabuklu-badem", source: "ciftlik" }),
      candidate({ slug: "findik-ici", source: "secki" }),
      candidate({ slug: "tarhana", source: "mutfak" }),
    ])
    assert.deepEqual(chosen, {
      ciftlik: "kabuklu-badem",
      secki: "findik-ici",
      mutfak: "tarhana",
    })
  })

  it("ignores products that are not featured, and archived ones that still are", () => {
    const chosen = pickIntroSlugPerSource([
      candidate({ slug: "arsivlenmis", isActive: false }),
      candidate({ slug: "one-cikmayan", isFeatured: false }),
      candidate({ slug: "kabuklu-badem" }),
    ])
    assert.deepEqual(chosen, { ciftlik: "kabuklu-badem" })
  })

  it("lets display order decide when a source has more than one featured product", () => {
    const chosen = pickIntroSlugPerSource([
      candidate({ slug: "ikinci", displayOrder: 5 }),
      candidate({ slug: "birinci", displayOrder: 1 }),
      candidate({ slug: "ucuncu", displayOrder: 9 }),
    ])
    assert.equal(chosen.ciftlik, "birinci")
  })

  it("breaks a display-order tie by the older product, never at random", () => {
    const chosen = pickIntroSlugPerSource([
      candidate({ slug: "yeni", displayOrder: 2, createdAt: "2026-05-01T00:00:00.000Z" }),
      candidate({ slug: "eski", displayOrder: 2, createdAt: "2026-02-01T00:00:00.000Z" }),
    ])
    assert.equal(chosen.ciftlik, "eski")
    // Same input in the opposite order must give the same answer.
    const reversed = pickIntroSlugPerSource([
      candidate({ slug: "eski", displayOrder: 2, createdAt: "2026-02-01T00:00:00.000Z" }),
      candidate({ slug: "yeni", displayOrder: 2, createdAt: "2026-05-01T00:00:00.000Z" }),
    ])
    assert.equal(reversed.ciftlik, "eski")
  })

  it("leaves a source unselected rather than borrowing another source's product", () => {
    const chosen = pickIntroSlugPerSource([
      candidate({ slug: "kabuklu-badem", source: "ciftlik" }),
    ])
    assert.equal(chosen.secki, undefined)
    assert.equal(chosen.mutfak, undefined)
    // The homepage falls back to its curated entry for those two sources.
  })

  it("selects nothing from an empty or unreadable catalogue", () => {
    assert.deepEqual(pickIntroSlugPerSource([]), {})
  })
})
