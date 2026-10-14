import Link from "next/link";
import { routes } from "@/lib/site";

/**
 * Fiyatların yanındaki kanıt: ince orman kurdele, tek satır, belgeye çıkış.
 * Kağıt zeminler arasında mühür gibi durur; tam belge çiftlik sayfasının
 * sonunda, burası rozet görevi görür — fiyatla kanıt aynı ekranda buluşur.
 */
export function CertStrip() {
  return (
    <section
      aria-label="Sertifika"
      className="on-dark border-t border-ink/10 bg-forest text-cream"
    >
      <div className="wrap flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-relaxed text-cream/80">
          <span className="label mr-3 text-shell">Belge</span>
          Organik sertifikalı üretim — TR-OT-012-MS-510/02 · ANADOLU Kontrol
          (TÜRKAK akrediteli).
        </p>
        <Link
          href={`${routes.farm}#sertifika`}
          prefetch={false}
          className="group inline-flex shrink-0 items-center gap-2 text-sm text-cream/75 transition-colors duration-300 hover:text-cream"
        >
          Belgeyi gör
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
