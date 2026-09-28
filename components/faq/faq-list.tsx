import { faqs, type FaqGroup } from "@/content/faqs";

/**
 * Visible accordion plus its own FAQPage JSON-LD — one import per page,
 * so what the reader sees and what Google reads are always identical.
 */
export function FaqList({ group, heading = "Sıkça sorulanlar" }: { group: FaqGroup; heading?: string }) {
  const items = faqs[group];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section aria-label={heading} className="wrap pb-24 md:pb-32">
      <h2 className="label text-olive">{heading}</h2>
      <div className="mt-8 grid max-w-3xl gap-3">
        {items.map((f) => (
          <details
            key={f.q}
            className="rounded-xl border border-ink/10 bg-paper px-5 py-4"
          >
            <summary className="cursor-pointer text-sm font-semibold text-ink marker:text-olive">
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink/65">{f.a}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
