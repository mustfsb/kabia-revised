import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { loadSettingsByGroup } from "@/lib/admin/queries/settings"
import { can } from "@/lib/admin/roles"
import { formatCurrency, toNumber } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { EmptyState, InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { PublishTag } from "@/components/admin/ui/status"
import { SOURCES, type ProductSource } from "@/lib/products"
import { pickIntroSlugPerSource } from "@/lib/homepage-intro"
import { SettingsGroupForm } from "../settings/settings-form"
import { toggleFeaturedAction } from "./actions"

export const metadata: Metadata = { title: "İçerik" }
export const dynamic = "force-dynamic"

export default async function ContentPage() {
  const { session, supabase } = await adminPageContext("manageContent")

  const [groups, productsRes] = await Promise.all([
    loadSettingsByGroup(supabase),
    supabase
      .from("products")
      .select(
        "id, name, slug, base_price, main_image_url, is_active, is_featured, source, display_order, created_at",
      )
      .order("is_featured", { ascending: false })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(60),
  ])

  if (productsRes.error) logQueryError("content:products", productsRes.error)

  const products = (productsRes.data ?? []) as {
    id: string
    name: string
    slug: string
    base_price: number | string
    main_image_url: string | null
    is_active: boolean
    is_featured: boolean
    source: ProductSource
    display_order: number | null
    created_at: string
  }[]

  // The same rule the homepage itself applies, so this screen cannot claim a
  // different product is introducing a source than the one that actually is.
  const introBySource = pickIntroSlugPerSource(
    products.map((product) => ({
      slug: product.slug,
      source: product.source,
      isActive: product.is_active,
      isFeatured: product.is_featured,
      displayOrder: product.display_order ?? 0,
      createdAt: product.created_at,
    })),
  )

  const sourceGroups = SOURCES.filter((entry) => entry.id !== "tumu").map((entry) => {
    const id = entry.id as ProductSource
    return {
      id,
      badgeLabel: entry.badgeLabel,
      introSlug: introBySource[id],
      products: products.filter((product) => product.source === id),
    }
  })

  const canEditSensitive = can(session.role, "manageSensitiveSettings")

  return (
    <>
      <PageHeader
        title="İçerik"
        description="Mağazanın operasyonel metinleri ve anasayfa seçkisi. Tasarım ve sayfa düzeni kodda kalır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "İçerik" }]}
      />

      <div className="mb-6">
        <InlineAlert tone="info">
          Bu ekran bir sayfa oluşturucu değildir. Yalnızca işletmeyle birlikte değişen
          bilgiler — duyuru, iletişim, sosyal hesaplar ve anasayfa seçkisi — düzenlenebilir.
          Girilen metinler mağazada düz metin olarak gösterilir; HTML veya betik çalıştırılmaz.
        </InlineAlert>
      </div>

      <div className="space-y-6">
        <SettingsGroupForm
          group="content"
          title="Duyuru ve iletişim"
          description="Duyuru bandı açıldığında mağazanın üst kısmında görünür."
          settings={groups.content ?? []}
          canEditSensitive={canEditSensitive}
          longFields={["announcement_text"]}
        />

        <SettingsGroupForm
          group="shop_banner"
          title="Mağaza banner'ı"
          description="Mağaza sayfasının en üstünde gösterilen kampanya banner'ı. Görseli önce Medya kütüphanesine yükleyip URL'sini buraya yapıştırın."
          settings={groups.shop_banner ?? []}
          canEditSensitive={canEditSensitive}
          longFields={["shop_banner_subtext"]}
        />

        <Panel
          title="Anasayfa seçkisi"
          description="Anasayfa üç kaynağı birer ürünle tanıtır. Her kaynakta öne çıkan ürünlerden sırası en küçük olanı gösterilir; hiçbiri seçili değilse o kaynak için sayfadaki mevcut tanıtım korunur."
          bodyClassName="px-0 py-0 md:px-0"
        >
          {products.length === 0 ? (
            <div className="px-4 py-6 md:px-5">
              <EmptyState
                title="Henüz ürün yok"
                description="Ürün ekledikçe burada seçki yapabilirsiniz."
              />
            </div>
          ) : (
            <div>
              {sourceGroups.map((group) => (
                <section key={group.id} aria-label={group.badgeLabel}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink/[0.07] bg-ink/[0.02] px-4 py-3 md:px-5">
                    <h3 className="text-sm text-ink">{group.badgeLabel}</h3>
                    <p className="text-xs text-ink/45">
                      {group.introSlug
                        ? `Anasayfada: ${
                            group.products.find((product) => product.slug === group.introSlug)?.name ??
                            group.introSlug
                          }`
                        : "Anasayfada: seçim yok"}
                    </p>
                  </div>

                  {group.products.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-ink/45 md:px-5">
                      Bu kaynakta ürün yok.
                    </p>
                  ) : (
                    <ul className="divide-y divide-ink/[0.07]">
                      {group.products.map((product) => (
                        <li
                          key={product.id}
                          className="flex flex-wrap items-center gap-4 px-4 py-3 md:px-5"
                        >
                          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-media bg-ink/[0.06]">
                            {product.main_image_url && (
                              <Image
                                src={product.main_image_url}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <Link
                              href={`/admin/products/${product.id}`}
                              prefetch={false}
                              className="block truncate text-sm text-ink transition-colors duration-200 hover:text-brand"
                            >
                              {product.name}
                            </Link>
                            <span className="figure mt-0.5 block text-xs text-ink/45">
                              {formatCurrency(toNumber(product.base_price))}
                            </span>
                          </span>

                          {product.slug === group.introSlug && (
                            <span className="label shrink-0 text-brand">Anasayfada</span>
                          )}

                          <PublishTag active={product.is_active} />

                          <form action={toggleFeaturedAction} className="shrink-0">
                            <input type="hidden" name="product_id" value={product.id} />
                            <input
                              type="hidden"
                              name="featured"
                              value={product.is_featured ? "false" : "true"}
                            />
                            <button
                              type="submit"
                              disabled={!product.is_active && !product.is_featured}
                              className={
                                product.is_featured
                                  ? "inline-flex min-h-11 items-center rounded-full border border-brand px-4 text-sm text-brand transition-colors duration-300 hover:bg-brand hover:text-on-brand"
                                  : "inline-flex min-h-11 items-center rounded-full border border-ink/15 px-4 text-sm text-ink/65 transition-colors duration-300 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                              }
                            >
                              {product.is_featured ? "Çıkar" : "Ekle"}
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
