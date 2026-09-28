import { emanet } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";

/**
 * The Emanet manifesto — the dark, quiet passage after Yaklaşım.
 *
 * Carried over from the 3000 soul: the soil is not ours, it is lent to us
 * by the future. Slow, true, lasting — not fast.
 */
export function Emanet() {
  return (
    <section
      aria-labelledby="emanet-heading"
      className="on-dark bg-forest text-cream"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 text-center md:px-10 md:py-32">
        <Reveal>
          <p className="label text-shell">{emanet.eyebrow}</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2
            id="emanet-heading"
            className="mx-auto mt-6 max-w-2xl text-3xl tracking-tight md:text-4xl"
          >
            {emanet.titleA}
            <br />
            <em className="font-theme-display italic text-shell">
              {emanet.titleB}
            </em>
          </h2>
        </Reveal>
        <Reveal delay={0.16}>
          <a
            href="/ciftlik#emanet"
            className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm text-shell transition-colors duration-300 hover:text-cream"
          >
            Emanetin tamamını gör
            <span aria-hidden="true">→</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
