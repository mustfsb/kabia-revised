import { getCachedFeaturedFullProducts } from "@/lib/catalog";
import { BestSellerCard } from "@/components/home/best-seller-card";
import { ArrowLink } from "@/components/ui/button";
import { routes } from "@/lib/site";

/**
 * Öne çıkanlar şeridi: fiyat ve sepete ekle ile.
 *
 * Satış başlamadığı için "Çok Satanlar" denmiyor — o isim ilk siparişlerden
 * sonra hak edilir. Hikayenin sonunda, FinalCta ile haber-ver bandının
 * komşuluğunda durur: okudun, beğendin, al; alamıyorsan e-postanı bırak.
 * Üç dünya bölümüyle üst üste binmemesi için bilerek buradadır.
 */
export async function BestSellers() {
  const products = await getCachedFeaturedFullProducts();
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby="bestsellers-heading"
      className="border-b border-ink/10 bg-paper"
    >
      <div className="wrap py-24 md:py-32">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p className="label text-olive">Öne çıkanlar</p>
            <h2
              id="bestsellers-heading"
              className="mt-5 text-3xl leading-[1.15] tracking-tight md:text-4xl"
            >
              Önce bunlara <em className="font-theme-display italic text-brand">bakın</em>.
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-ink/60 md:col-span-4 md:col-start-9">
            Dördü de bahçeden ya da tanıdığımız üreticiden. Stoklar hasatla
            birlikte açılıyor.
          </p>
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <BestSellerCard key={product.id} product={product} />
          ))}
        </ul>

        <div className="mt-14 border-t border-ink/10 pt-7">
          <ArrowLink href={routes.store}>Mağazayı gör</ArrowLink>
        </div>
      </div>
    </section>
  );
}
