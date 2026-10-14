"use client";

import { usePathname } from "next/navigation";
import { routes, whatsappHref } from "@/lib/site";

/**
 * Her sayfada sağ altta duran WhatsApp hattı. Yeşil daire + ahize,
 * hazır mesajlı link; JavaScript gerektirmez, saf hizada bir linktir.
 *
 * Mobilde alt barı olan sayfalarda (/shop/[slug] ürün barı, /odeme toplam
 * barı) buton yukarı kayar — yoksa satın alma düğmesini kapatır. Masaüstünde
 * alt bar olmadığı için hep aynı yerdedir. safe-area her durumda eklenir.
 */
export function WhatsAppFloat() {
  const pathname = usePathname();
  const hasBottomBar =
    pathname === routes.checkout || pathname.startsWith("/shop/");

  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp'tan yazın"
      title="WhatsApp'tan yazın"
      style={{
        backgroundColor: "#25d366",
        bottom: hasBottomBar
          ? "calc(6rem + env(safe-area-inset-bottom, 0px))"
          : "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
      }}
      className="fixed right-5 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg transition-all duration-300 hover:scale-105"
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
