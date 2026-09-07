import type { MetadataRoute } from "next"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchPublicProducts } from "@/lib/catalog"
import { site, routes, sitemapStaticPaths } from "@/lib/site"

/**
 * Only the routes safe to advertise to crawlers: static pages and active
 * products. Preview products and preview producer stores are never
 * included — they exist solely behind the design-review switch.
 *
 * The static list lives in lib/site.ts next to the route table, so a new brand
 * page cannot be added to the site and forgotten here. Producer URLs are not
 * advertised yet: the producers table has no administered rows to draw from.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createSupabaseServerClient()

  const productsResult = await fetchPublicProducts(supabase)

  const staticEntries: MetadataRoute.Sitemap = sitemapStaticPaths.map((entry) => ({
    // The homepage is "/" in the route table; the sitemap wants the bare origin.
    url: entry.path === routes.home ? site.url : `${site.url}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))

  const productEntries: MetadataRoute.Sitemap =
    productsResult.status === "ok"
      ? productsResult.products.map((p) => ({
          url: `${site.url}${routes.product(p.slug)}`,
          changeFrequency: "weekly",
          priority: 0.7,
        }))
      : []

  return [...staticEntries, ...productEntries]
}
