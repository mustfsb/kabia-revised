"use server"

import { revalidatePath, updateTag } from "next/cache"
import { adminContext } from "@/lib/admin/auth"
import { AUDIT_WARNING, logAdminAction } from "@/lib/admin/audit"
import { fieldErrorsFrom } from "@/lib/admin/schemas"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { shopSliderSaveSchema } from "@/lib/shop-slider"
import { SHOP_SLIDER_TAG } from "@/lib/shop-slider-read"

/**
 * Saves the whole /magaza slider — mode, slides and featured products — in one
 * call to admin_save_shop_slider, so the storefront never sees half a save.
 *
 * The editor sends one JSON field (`payload`). It is parsed with the same schema
 * the tests pin, and the database checks the limits again: a slide's media
 * must be a live library asset, a poster an image, featured products published.
 */
export async function saveShopSliderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageContent")

    let raw: unknown
    try {
      raw = JSON.parse(String(formData.get("payload") ?? ""))
    } catch {
      return { ok: false, message: "Slider bilgisi okunamadı." }
    }

    const parsed = shopSliderSaveSchema.safeParse(raw)
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fieldErrorsFrom(parsed.error),
        message: parsed.error.issues[0]?.message ?? "Lütfen slider ayarlarını kontrol edin.",
      }
    }
    const input = parsed.data

    const { data: before } = await supabase.from("shop_slider_config").select("mode, show_featured_below").maybeSingle()

    const { error } = await supabase.rpc("admin_save_shop_slider", {
      p_mode: input.mode,
      p_show_featured_below: input.show_featured_below,
      p_slides: input.slides,
      p_featured: input.featured,
    })
    if (error) return toActionState(error, "saveShopSlider")

    const audited = await logAdminAction(supabase, {
      action: "content.update",
      entityType: "setting",
      entityId: "shop_slider",
      before: before ?? undefined,
      after: {
        mode: input.mode,
        show_featured_below: input.show_featured_below,
        slide_count: input.slides.length,
        featured: input.featured,
      },
      metadata: { area: "shop_slider" },
    })

    // updateTag, as the settings save does: the operator sees their own write
    // on the very next render.
    updateTag(SHOP_SLIDER_TAG)
    revalidatePath("/magaza")
    revalidatePath("/admin/content")

    return {
      ok: true,
      message: "Slider kaydedildi ve mağazaya yansıtıldı.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "saveShopSlider")
  }
}
