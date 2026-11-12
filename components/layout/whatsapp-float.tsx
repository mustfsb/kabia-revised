"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isContactFloatRoute, whatsappHref } from "@/lib/site";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

const subscribeMounted = () => () => {};

/**
 * Sağ altta duran WhatsApp hattı. Yeşil daire + ahize, hazır mesajla açılır;
 * saf hizada bir linktir.
 *
 * Görünürlük tek kurala bağlıdır: lib/site.ts içindeki
 * `isContactFloatRoute` allowlist'i. Listede olmayan hiçbir rotada render
 * edilmez — hesap/auth yüzeylerindeki eski koşullu gizleme mantığı bu
 * kurala taşınmış ve bileşenden kaldırılmıştır.
 *
 * Ürün sayfalarında (/shop/*) mobil sticky satın-alma barı alt kenarı tutar;
 * buton orada barın üstüne kayar, yoksa satın-alma düğmesini kapatır.
 * Masaüstünde alt bar olmadığı için hep aynı yerdedir.
 *
 * Gizliyken DOM'da hiç yoktur: odaklanamaz ve duyurulamaz — yalnızca görsel
 * gizleme değil. Belirme/kaybolma kısa bir fade ile olur; reduced-motion
 * tercihinde anlıktır.
 *
 * State updates happen during render (route change, first show) or in event
 * callbacks — never synchronously inside an effect — so the first server
 * and client renders agree and no cascading renders occur.
 */
export function WhatsAppFloat() {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  // False on the server and on the first client render, true after — so the
  // button never flashes before the route is known.
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  // Kept in the DOM through the exit fade, then removed on animation end.
  const [rendered, setRendered] = useState(false);

  const routeAllowed = isContactFloatRoute(pathname);
  // Product pages carry the mobile sticky buy bar along the bottom edge;
  // the button rides above it there, at its normal spot everywhere else.
  const aboveBuyBar = pathname.startsWith("/shop/");

  const shouldShow = mounted && routeAllowed;
  if (shouldShow && !rendered) setRendered(true);
  // Reduced motion: no exit fade to wait for, unmount on the spot.
  if (!shouldShow && reducedMotion && rendered) setRendered(false);
  const fadingOut = rendered && !shouldShow;

  if (!rendered) return null;
  if (!shouldShow && reducedMotion) return null;

  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp'tan yazın"
      title="WhatsApp'tan yazın"
      style={{ backgroundColor: "#25d366" }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && fadingOut) setRendered(false);
      }}
      // Bottom-right, clear of the home indicator. z-30 keeps it stacked
      // beneath the open mobile menu (which lives in the header's z-40
      // stacking context), so the menu is never covered by the button.
      className={`fixed right-5 z-30 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg transition-all duration-300 hover:scale-105 ${
        aboveBuyBar ? "bottom-[calc(6rem+var(--safe-bottom))]" : "bottom-[calc(1.25rem+var(--safe-bottom))]"
      } ${reducedMotion ? "" : fadingOut ? "contact-float-out" : "contact-float-in"}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    </a>
  );
}
