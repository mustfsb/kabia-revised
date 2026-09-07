"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction } from "@/lib/admin/audit"
import { toActionState } from "@/lib/admin/errors"
import { uuid } from "@/lib/admin/schemas"
import { HOMEPAGE_INTRO_TAG } from "@/lib/catalog"

const featureSchema = z.object({
  product_id: uuid,
  featured: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
})

/**
 * Toggles a product's place in the homepage introduction.
 *
 * This is the whole of "homepage featured products" — a flag on a real product,
 * not a page builder. The homepage's layout, statement lines and source names
 * stay in code where they belong; only the *selection* is operational data.
 *
 * The homepage introduces one product per source, so marking a second product
 * of the same source does not add a fourth tile: display order decides which
 * one introduces that source. See lib/homepage-intro.ts.
 */
export async function toggleFeaturedAction(formData: FormData): Promise<void> {
  try {
    const { supabase } = await adminContext("manageContent")

    const parsed = featureSchema.safeParse({
      product_id: formData.get("product_id"),
      featured: formData.get("featured"),
    })
    if (!parsed.success) return

    // Re-read authoritative state; the form's idea of "currently featured" is
    // only used to decide which button was rendered.
    const { data: before } = await supabase
      .from("products")
      .select("id, name, is_featured, is_active")
      .eq("id", parsed.data.product_id)
      .maybeSingle()

    if (!before) return

    if (parsed.data.featured && !before.is_active) {
      // An archived product must never appear in the homepage selection.
      return
    }

    const { error } = await supabase
      .from("products")
      .update({ is_featured: parsed.data.featured })
      .eq("id", parsed.data.product_id)

    if (error) {
      console.error("[admin] toggleFeatured:", error)
      return
    }

    await logAdminAction(supabase, {
      action: "content.update",
      entityType: "product",
      entityId: before.id,
      before: { is_featured: before.is_featured },
      after: { is_featured: parsed.data.featured },
      metadata: { name: before.name, area: "homepage_featured" },
    })

    // The homepage introduction is read through unstable_cache, which
    // revalidatePath does not reach — the tag is what makes the change show up
    // straight away instead of after the 300s ceiling. `updateTag` rather than
    // `revalidateTag` for the same reason the settings action gives: this is a
    // Server Action and the operator must see their own write.
    updateTag(HOMEPAGE_INTRO_TAG)
    revalidatePath("/")
    revalidatePath("/shop")
    revalidatePath("/magaza")
    revalidatePath("/admin/content")
  } catch (error) {
    // Void-returning form action: surface through logs, never through a thrown
    // error that would blank the page.
    toActionState(error, "toggleFeatured")
  }
}
