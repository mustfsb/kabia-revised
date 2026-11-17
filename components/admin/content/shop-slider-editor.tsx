"use client"

import { useActionState, useCallback, useMemo, useState } from "react"
import Image from "next/image"
import { ArrowDown, ArrowUp, X } from "lucide-react"
import { saveShopSliderAction } from "@/app/admin/(protected)/content/slider-actions"
import { MediaPicker } from "@/components/admin/media/media-picker"
import { AdminButton, AdminCheckbox, AdminInput, AdminSelect, FormMessage, SubmitButton } from "@/components/admin/ui/form"
import { InlineAlert, Panel } from "@/components/admin/ui/surfaces"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { mediaKindOf, type MediaAsset } from "@/lib/admin/media"
import type { AdminSlide, AdminSlideMedia, ShopSliderAdmin } from "@/lib/admin/queries/shop-slider"
import { formatTL } from "@/lib/products"
import { SLIDER_BELOW_COUNT, SLIDER_MAX_FEATURED, SLIDER_MAX_SLIDES, type SliderMode } from "@/lib/shop-slider"

/**
 * The /magaza slider, administered in one place.
 *
 * Both lists are kept while the mode changes, so switching from "Öne çıkan
 * ürünler" to "Medya" and back loses nothing; the whole state is saved together
 * (one RPC, one transaction). The picker uploads too — images through the app,
 * videos straight to Storage — so a new slide never needs a trip to /admin/media.
 */

type EditorSlide = AdminSlide & { key: string }

const toMedia = (asset: MediaAsset): AdminSlideMedia => ({
  id: asset.id,
  url: asset.url,
  label: asset.label,
  kind: mediaKindOf(asset.mimeType),
})

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function MediaPreview({ media, className }: { media: AdminSlideMedia; className?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-[3px] bg-ink/[0.06] ${className ?? ""}`}>
      {media.kind === "video" ? (
        <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Image src={media.url} alt="" fill sizes="160px" className="object-cover" />
      )}
    </span>
  )
}

const MODE_OPTIONS: { value: SliderMode; label: string; hint: string }[] = [
  { value: "off", label: "Kapalı", hint: "Mağaza sayfası slider'sız açılır." },
  { value: "media", label: "Medya slider'ı", hint: "Fotoğraf ve videolar 5 saniyede bir kayar." },
  { value: "products", label: "Öne çıkan ürünler", hint: "Seçilen ürünler slider'da 5 saniyede bir kayar." },
]

export function ShopSliderEditor({ initial }: { initial: ShopSliderAdmin }) {
  const [state, formAction] = useActionState(saveShopSliderAction, ACTION_IDLE)
  const [mode, setMode] = useState<SliderMode>(initial.mode)
  const [showBelow, setShowBelow] = useState(initial.showFeaturedBelow)
  const [slides, setSlides] = useState<EditorSlide[]>(() =>
    initial.slides.map((slide) => ({ ...slide, key: crypto.randomUUID() })),
  )
  const [featured, setFeatured] = useState<string[]>(initial.featured)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [posterFor, setPosterFor] = useState<string | null>(null)
  const [productChoice, setProductChoice] = useState("")
  const closeMedia = useCallback(() => setMediaPickerOpen(false), [])
  const closePoster = useCallback(() => setPosterFor(null), [])

  const productsById = useMemo(() => new Map(initial.products.map((p) => [p.id, p])), [initial.products])
  const errors = state.fieldErrors ?? {}

  const payload = JSON.stringify({
    mode,
    show_featured_below: showBelow,
    slides: slides.map((s) => ({
      media_asset_id: s.media.id,
      poster_asset_id: s.media.kind === "video" ? (s.poster?.id ?? null) : null,
      headline: s.headline,
      alt_text: s.altText,
      link_href: s.linkHref,
      link_label: s.linkLabel,
    })),
    featured,
  })

  const updateSlide = (key: string, patch: Partial<EditorSlide>) =>
    setSlides((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const room = SLIDER_MAX_SLIDES - slides.length

  return (
    <form action={formAction}>
      <input type="hidden" name="payload" value={payload} />
      <Panel
        title="Mağaza slider'ı"
        description="Mağaza sayfasının en üstünde, ürün listesiyle aynı genişlikte gösterilir. Değişiklikler kaydedince yayına girer."
      >
        <div className="space-y-8">
          {initial.unavailable && (
            <InlineAlert tone="danger">
              Slider ayarları okunamadı. Veritabanı güncellemesi henüz uygulanmamış olabilir; kaydetmeden önce sayfayı yenileyin.
            </InlineAlert>
          )}

          <fieldset>
            <legend className="label mb-3 text-olive">Gösterim</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-[3px] border px-4 py-3 text-sm transition-colors ${
                    mode === option.value ? "border-brand bg-brand/5" : "border-ink/15 hover:border-brand/40"
                  }`}
                >
                  <span className="flex items-center gap-2 text-ink">
                    <input
                      type="radio"
                      name="slider_mode"
                      value={option.value}
                      checked={mode === option.value}
                      onChange={() => setMode(option.value)}
                      className="accent-[var(--color-brand)]"
                    />
                    {option.label}
                  </span>
                  <span className="pl-6 text-xs text-ink/50">{option.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === "media" && (
            <section aria-labelledby="slider-slides-heading" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 id="slider-slides-heading" className="label text-olive">
                    Slaytlar ({slides.length}/{SLIDER_MAX_SLIDES})
                  </h3>
                  <p className="mt-1 text-xs text-ink/50">
                    Fotoğraf veya video. Başlık ve buton isteğe bağlıdır; ikisi de boşsa yalnızca medya görünür.
                  </p>
                </div>
                <AdminButton variant="outline" disabled={room <= 0} onClick={() => setMediaPickerOpen(true)}>
                  Medyadan seç veya yükle
                </AdminButton>
              </div>

              {errors.slides && <p role="alert" className="text-xs text-clay">{errors.slides}</p>}

              {slides.length === 0 ? (
                <p className="rounded-[3px] border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50">
                  Henüz slayt yok.
                </p>
              ) : (
                <ol className="space-y-3">
                  {slides.map((slide, index) => (
                    <li key={slide.key} className="rounded-[3px] border border-ink/10 p-3 md:p-4">
                      <div className="flex flex-col gap-4 md:flex-row">
                        <div className="shrink-0 space-y-2">
                          <MediaPreview media={slide.media} className="h-24 w-40" />
                          <p className="max-w-40 truncate text-xs text-ink/50" title={slide.media.label}>
                            {slide.media.kind === "video" ? "Video · " : ""}
                            {slide.media.label}
                          </p>
                          {slide.media.kind === "video" && (
                            <div className="flex items-center gap-2">
                              {slide.poster && <MediaPreview media={slide.poster} className="h-8 w-12" />}
                              <button
                                type="button"
                                onClick={() => setPosterFor(slide.key)}
                                className="text-xs text-brand underline-offset-2 hover:underline"
                              >
                                {slide.poster ? "Kapağı değiştir" : "Kapak görseli seç"}
                              </button>
                              {slide.poster && (
                                <button
                                  type="button"
                                  onClick={() => updateSlide(slide.key, { poster: null })}
                                  className="text-xs text-ink/50 hover:text-clay"
                                >
                                  Kaldır
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                          <AdminInput
                            label="Başlık"
                            value={slide.headline}
                            maxLength={80}
                            error={errors[`slides.${index}.headline`]}
                            onChange={(e) => updateSlide(slide.key, { headline: e.target.value })}
                            wrapperClassName="sm:col-span-2"
                          />
                          <AdminInput
                            label="Buton yazısı"
                            value={slide.linkLabel}
                            maxLength={30}
                            error={errors[`slides.${index}.link_label`]}
                            onChange={(e) => updateSlide(slide.key, { linkLabel: e.target.value })}
                          />
                          <AdminInput
                            label="Buton linki"
                            value={slide.linkHref}
                            maxLength={300}
                            placeholder="/magaza?kategori=badem"
                            error={errors[`slides.${index}.link_href`]}
                            onChange={(e) => updateSlide(slide.key, { linkHref: e.target.value })}
                          />
                          <AdminInput
                            label={slide.media.kind === "video" ? "Video açıklaması (ekran okuyucu)" : "Alternatif metin"}
                            value={slide.altText}
                            maxLength={200}
                            error={errors[`slides.${index}.alt_text`]}
                            onChange={(e) => updateSlide(slide.key, { altText: e.target.value })}
                            wrapperClassName="sm:col-span-2"
                          />
                        </div>

                        <div className="flex shrink-0 gap-1 md:flex-col">
                          <AdminButton variant="ghost" aria-label="Yukarı taşı" disabled={index === 0} onClick={() => setSlides((p) => move(p, index, index - 1))}>
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </AdminButton>
                          <AdminButton variant="ghost" aria-label="Aşağı taşı" disabled={index === slides.length - 1} onClick={() => setSlides((p) => move(p, index, index + 1))}>
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </AdminButton>
                          <AdminButton variant="ghost" aria-label="Slaytı kaldır" onClick={() => setSlides((p) => p.filter((s) => s.key !== slide.key))}>
                            <X className="h-4 w-4" aria-hidden="true" />
                          </AdminButton>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <AdminCheckbox
                label={`Slider'ın altında öne çıkan ürünleri göster (listenin ilk ${SLIDER_BELOW_COUNT} ürünü)`}
                checked={showBelow}
                onChange={(e) => setShowBelow(e.target.checked)}
              />
            </section>
          )}

          {(mode === "products" || (mode === "media" && showBelow)) && (
            <section aria-labelledby="slider-featured-heading" className="space-y-4">
              <div>
                <h3 id="slider-featured-heading" className="label text-olive">
                  Öne çıkan ürünler ({featured.length}/{SLIDER_MAX_FEATURED})
                </h3>
                <p className="mt-1 text-xs text-ink/50">
                  {mode === "products"
                    ? "Her ürün bir slayt olur; görsel, fiyat ve varsa indirim gösterilir."
                    : `Medya slider'ının altında ilk ${SLIDER_BELOW_COUNT} ürün kart olarak gösterilir.`}{" "}
                  Yalnızca yayındaki ürünler seçilebilir. Bu seçim anasayfa seçkisinden ayrıdır.
                </p>
              </div>

              {errors.featured && <p role="alert" className="text-xs text-clay">{errors.featured}</p>}

              <div className="flex flex-wrap items-end gap-2">
                <AdminSelect
                  label="Ürün ekle"
                  value={productChoice}
                  onChange={(e) => setProductChoice(e.target.value)}
                  wrapperClassName="min-w-0 flex-1 sm:max-w-sm"
                >
                  <option value="">Ürün seçin…</option>
                  {initial.products
                    .filter((p) => !featured.includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatTL(p.price)}
                      </option>
                    ))}
                </AdminSelect>
                <AdminButton
                  variant="outline"
                  disabled={!productChoice || featured.length >= SLIDER_MAX_FEATURED}
                  onClick={() => {
                    setFeatured((prev) => [...prev, productChoice])
                    setProductChoice("")
                  }}
                >
                  Ekle
                </AdminButton>
              </div>

              {featured.length > 0 && (
                <ol className="divide-y divide-ink/[0.07] rounded-[3px] border border-ink/10">
                  {featured.map((id, index) => {
                    const product = productsById.get(id)
                    return (
                      <li key={id} className="flex items-center gap-3 px-3 py-2">
                        <span className="figure w-5 text-xs text-ink/40">{index + 1}</span>
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-media bg-ink/[0.06]">
                          {product?.imageUrl && <Image src={product.imageUrl} alt="" fill sizes="40px" className="object-cover" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {product?.name ?? "Yayında olmayan ürün — kaldırın"}
                          {mode === "media" && index < SLIDER_BELOW_COUNT && (
                            <span className="ml-2 text-xs text-olive">altta gösterilir</span>
                          )}
                        </span>
                        <AdminButton variant="ghost" aria-label="Yukarı taşı" disabled={index === 0} onClick={() => setFeatured((p) => move(p, index, index - 1))}>
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </AdminButton>
                        <AdminButton variant="ghost" aria-label="Aşağı taşı" disabled={index === featured.length - 1} onClick={() => setFeatured((p) => move(p, index, index + 1))}>
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </AdminButton>
                        <AdminButton variant="ghost" aria-label="Ürünü kaldır" onClick={() => setFeatured((p) => p.filter((x) => x !== id))}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </AdminButton>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          )}

          <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <FormMessage state={state} className="min-w-0 flex-1" />
            <div className="flex shrink-0 items-center gap-3">
              <a href="/magaza" target="_blank" rel="noopener" className="text-sm text-ink/60 hover:text-brand">
                Mağazada görüntüle
              </a>
              <SubmitButton pendingLabel="Kaydediliyor…">{"Slider'ı kaydet"}</SubmitButton>
            </div>
          </div>
        </div>
      </Panel>

      <MediaPicker
        open={mediaPickerOpen}
        onClose={closeMedia}
        onConfirm={(assets) =>
          setSlides((prev) =>
            [
              ...prev,
              ...assets
                .filter((asset) => !prev.some((s) => s.media.id === asset.id))
                .map((asset) => ({
                  key: crypto.randomUUID(),
                  media: toMedia(asset),
                  poster: null,
                  headline: "",
                  altText: asset.altText ?? "",
                  linkHref: "",
                  linkLabel: "",
                })),
            ].slice(0, SLIDER_MAX_SLIDES),
          )
        }
        multiple
        kind="any"
        folder="slider"
        title="Slayt medyası seç"
      />

      <MediaPicker
        open={posterFor !== null}
        onClose={closePoster}
        onConfirm={(assets) => {
          const chosen = assets[0]
          if (chosen && posterFor) updateSlide(posterFor, { poster: toMedia(chosen) })
        }}
        multiple={false}
        kind="image"
        folder="slider"
        title="Kapak görseli seç"
      />
    </form>
  )
}
