import { FaqList } from "@/components/faq/faq-list";

/**
 * Satın alma itirazları ana sayfada erir: kargo, katkı, kapalı stok, iade.
 * Sorular content/faqs.ts magaza grubundan gelir — görünen metinle Google'a
 * giden JSON-LD aynı kaynaktan beslendiği için ikisi hiç ayrışmaz.
 */
export function HomeFaq() {
  return (
    <div className="border-t border-ink/10 bg-paper">
      <div className="pt-24 md:pt-32">
        <FaqList group="magaza" heading="Aklında kalanlar" />
      </div>
    </div>
  );
}
