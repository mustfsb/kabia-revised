"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { SliderProductSlide } from "@/components/shop/slider-product-slide"
import { autoplayInitiallyOn, SLIDER_INTERVAL_MS, type ShopSliderView, type SliderSlide } from "@/lib/shop-slider"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"
import { cn } from "@/lib/utils"

/**
 * The /magaza slider.
 *
 * It sits in the listing's own `wrap`, so its left edge is the first card's and
 * its right edge the last card's. The track is a native scroll-snap row — swipe
 * works without code — and the arrows scroll it by one slide. Every five seconds
 * it moves on by itself, wrapping at the end, and it holds still while the
 * reader is on it: pointer over it, focus inside it, or the tab in the
 * background. Reduced motion starts it paused; the one pause/play button covers
 * slides and video alike (WCAG 2.2.2).
 *
 * Arrows sit outside the frame where the page has room for them (≥1320px) and
 * inside its edges, over the media, where it does not.
 */

function readSaveData(): boolean {
  if (typeof navigator === "undefined") return false
  return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
}

function MediaSlide({ slide, active, playing, first }: { slide: SliderSlide; active: boolean; playing: boolean; first: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Read once, in the initializer, as the homepage hero does: never an effect.
  const [saveData] = useState(readSaveData)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active && playing && !saveData) void video.play().catch(() => {})
    else video.pause()
  }, [active, playing, saveData])

  const overlay = slide.headline || (slide.linkHref && slide.linkLabel)

  return (
    <div className="relative h-full w-full">
      {slide.kind === "video" ? (
        <video
          ref={videoRef}
          src={slide.src}
          poster={slide.posterSrc ?? undefined}
          muted
          loop
          playsInline
          preload={first ? "metadata" : "none"}
          aria-label={slide.alt ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image
          src={slide.src}
          alt={slide.alt ?? ""}
          fill
          priority={first}
          fetchPriority={first ? "high" : undefined}
          sizes="(min-width: 1200px) 1120px, 100vw"
          className="object-cover"
        />
      )}
      {overlay && (
        <div className="on-dark absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/80 via-ink/20 to-transparent p-6 pb-14 md:p-12 md:pb-14">
          {slide.headline && (
            <h2 className="max-w-2xl text-3xl leading-[1.1] tracking-tight text-cream md:text-5xl">{slide.headline}</h2>
          )}
          {slide.linkHref && slide.linkLabel && (
            <Link
              href={slide.linkHref}
              prefetch={false}
              tabIndex={active ? undefined : -1}
              className="mt-6 inline-block w-fit rounded-theme-button bg-cream px-7 py-3.5 text-sm font-medium text-forest transition-colors duration-300 hover:bg-ivory"
            >
              {slide.linkLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

const arrowClass =
  "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ivory/85 text-ink backdrop-blur-sm transition-colors duration-300 hover:bg-ivory hover:text-brand min-[1320px]:bg-transparent min-[1320px]:backdrop-blur-none min-[1320px]:border min-[1320px]:border-ink/15 min-[1320px]:hover:border-brand"

export function ShopSlider({ view }: { view: ShopSliderView }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [userPaused, setUserPaused] = useState<boolean | null>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [active, setActive] = useState(0)

  const count = view.mode === "media" ? view.slides.length : view.products.length
  // Until the reader chooses, reduced motion decides; after, their choice does.
  const playing = userPaused === null ? autoplayInitiallyOn(reducedMotion) : !userPaused
  const moving = playing && !hovered && !focused && !hidden && count > 1

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current
      if (!track || count === 0) return
      const next = (index + count) % count
      track.scrollTo({ left: next * track.clientWidth, behavior: reducedMotion ? "auto" : "smooth" })
      setActive(next)
    },
    [count, reducedMotion],
  )

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // Keyed on `active`: any change of slide — the timer's, an arrow's, a swipe's —
  // starts the five seconds again.
  useEffect(() => {
    if (!moving) return
    const timer = window.setTimeout(() => goTo(active + 1), SLIDER_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [moving, active, goTo])

  const onScroll = () => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    const index = Math.round(track.scrollLeft / track.clientWidth)
    if (index !== active && index >= 0 && index < count) setActive(index)
  }

  const slides: ReactNode[] =
    view.mode === "media"
      ? view.slides.map((slide, i) => (
          <MediaSlide key={slide.id} slide={slide} active={i === active} playing={playing && !hidden} first={i === 0} />
        ))
      : view.products.map((product, i) => <SliderProductSlide key={product.id} product={product} priority={i === 0} />)

  return (
    <section
      aria-roledescription="carousel"
      aria-label={view.mode === "media" ? "Mağaza vitrini" : "Öne çıkan ürünler"}
      className="wrap page-top"
    >
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
        }}
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          className={cn(
            "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-theme-product-image bg-paper [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            view.mode === "media" && "aspect-[4/5] md:aspect-[16/7]",
            view.mode === "products" && "md:aspect-[16/7]",
          )}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={i === active ? undefined : true}
              inert={i === active ? undefined : true}
              className="relative h-full w-full shrink-0 snap-start"
            >
              {slide}
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" aria-label="Önceki slayt" onClick={() => goTo(active - 1)} className={cn(arrowClass, "left-3 min-[1320px]:-left-16")}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Sonraki slayt" onClick={() => goTo(active + 1)} className={cn(arrowClass, "right-3 min-[1320px]:-right-16")}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-ink/55 py-1 pl-1 pr-3 text-cream backdrop-blur-sm">
              <button
                type="button"
                aria-label={playing ? "Slider'ı durdur" : "Slider'ı başlat"}
                aria-pressed={!playing}
                onClick={() => setUserPaused(playing)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-cream/15"
              >
                {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
              <span className="figure text-xs tabular-nums" aria-live={moving ? "off" : "polite"}>
                {active + 1} / {count}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
