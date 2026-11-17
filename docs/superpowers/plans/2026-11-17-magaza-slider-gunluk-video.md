# Mağaza slider'ı ve günlük videosu — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin'den yönetilen bir `/magaza` slider'ı (medya ya da öne çıkan ürünler, 5 sn otomatik kayma) ve günlük yazılarına panelden video ekleme.

**Architecture:** Videolar ayrı public bucket'a (`content-video`) tarayıcıdan imzalı adresle yüklenir ve `media_assets`'e kaydedilir. Slider üç tabloda tutulur, tek bir RPC ile atomik olarak kaydedilir. Mağaza anon istemciyle okur; `media_assets` anon'a kapalı olduğu için slayt ve günlük satırları medyanın `bucket/path/mime` bilgisini trigger ile kopyalar. Vitrin, `scroll-snap` tabanlı bağımlılıksız bir client bileşenidir.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres, RLS, Storage), Zod, Tailwind v4, node:test.

**Spec:** `docs/superpowers/specs/2026-11-17-magaza-slider-gunluk-video-design.md`

## Global Constraints

- **Test komutu:** `node tests/support/run-database-free.mjs`. **`npm test` asla çalıştırılmaz.** Yeni test dosyaları bu runner'ın listesine eklenir.
- Kontroller: `npx tsc --noEmit` (temel durumda `tests/admin-authorization.test.ts` içindeki hatalar önceden var), `npm run lint`, `npm run build`.
- **Push yok.** Commit'ler yerelde, bu worktree'de kalır.
- **Migration'lar canlıya uygulanamıyor:** Supabase MCP ve CLI, Kabia projesini görmüyor. Migration'lar idempotent yazılır; başlıklarında ne/neden/geri alma bulunur ve yalnızca ekleme yapılır (eski kod çalışmaya devam etmeli). Kodun üretime çıkması migration'ların uygulanmasına bağlıdır; bu rapora yazılır.
- Yeni bağımlılık yok. Arayüz metinleri Türkçe. Sabit değerler: `VIDEO_MAX_BYTES = 50 MB`, MIME `video/mp4` ve `video/webm`, slayt en fazla 6, öne çıkan ürün en fazla 12, medya modunda altta ilk 3 ürün, otomatik kayma 5000 ms.
- Slider yalnızca `/magaza`'da (`app/shop/page.tsx`) gösterilir.

## Review Focus

1. **Slider okuması hata verirse:** mağaza slider'sız açılmalı, 5xx vermemeli. Test: `getShopSliderView` hata sonucu `null` döner.
2. **Öne çıkan ürün sonradan pasifleşirse ya da silinirse:** vitrin onu atlamalı; hiç ürün kalmazsa slider gizlenmeli. Test: `resolveSliderView` pasif ve eksik ürünleri düşürür, ürün modunda boş listede `null` döner.
3. **Video yerine yeniden adlandırılmış bir dosya yüklenirse:** finalize reddetmeli ve nesneyi silmeli. Test: `probeVideo` sahte başlığı reddeder.
4. **Admin'in bir slayt linkine dış ya da tehlikeli bir URL yazması:** reddedilmeli. Test: şema `https://evil`, `//evil` ve `javascript:` değerlerini reddeder.
5. **Kullanıcının hareketi azaltma ayarı (reduced motion):** otomatik kayma başlamamalı. Test: `autoplayInitiallyOn(reduced)` sözleşmesi.

---

### Task 1: Migration'lar

**Files:**
- Create: `supabase/migrations/20261117000000_content_video.sql`
- Create: `supabase/migrations/20261117000100_shop_slider.sql`
- Test: `tests/shop-slider-migration.test.ts` (SQL metni üzerinde sözleşme testi)

**Interfaces — Produces:**
- **Bucket `content-video`:** public, `file_size_limit 52428800`, `{video/mp4, video/webm}`. Politikalar `content_video_public_read`, `content_video_admin_insert`, `content_video_admin_update` ve `content_video_admin_delete`, `product-media` ile aynı biçimde.
- **`media_assets`:** `media_assets_mime_allowed` CHECK'i 6 türe genişler. Yeni `media_assets_bucket_kind_check`: video yalnızca `content-video`'da, görsel yalnızca `product-media`'da.
- **`journal_entries` yeni kolonlar:** `video_asset_id uuid null references media_assets on delete restrict`, `video_bucket text null`, `video_object_path text null`.
- **Trigger `journal_entries_sync_video`:** `security definer`. Kolonları `media_assets`'ten doldurur. Asset bir video değilse ya da silinmişse `22023` hatası verir. `video_asset_id` null ise iki kolonu da null yapar.
- **CHECK `journal_entries_one_video`:** `video_path is null or video_asset_id is null`.
- **Tablolar:**
  - `shop_slider_config(id boolean pk default true check(id), mode text check in ('off','media','products') default 'off', show_featured_below boolean default false, updated_at, updated_by uuid)`. Tek bir `('off')` satırıyla seed edilir.
  - `shop_slides(id, media_asset_id not null fk restrict, poster_asset_id fk restrict, media_bucket, media_path, media_mime, poster_bucket, poster_path, headline ≤80, alt_text ≤200, link_href ≤300 '^/[^/]', link_label ≤30, sort_order 0..5 unique)`. CHECK: link çifti birlikte dolu ya da birlikte boş. Trigger `shop_slides_sync_media`: poster bir görsel olmalı, medya görsel ya da video olabilir.
  - `shop_featured_products(product_id uuid unique fk products on delete cascade, sort_order 0..11 unique)`.
- **RLS:** anon ve authenticated `select` (üç tablo). Yazma `has_admin_role()` ile.
- **RPC:** `public.admin_save_shop_slider(p_mode text, p_show_featured_below boolean, p_slides jsonb, p_featured uuid[]) returns void`, security invoker, `has_admin_role()`. Doğrulamalar: slayt ≤ 6, ürün ≤ 12 ve hepsi aktif, ürünler tekrarsız, `products` modunda ≥1 ürün, `media` modunda ≥1 slayt. Silip yeniden ekler ve config'i günceller. Hata mesajları Türkçe.
- **Banner seed:** `site_settings` içinde `shop_banner_enabled` true ise ve `shop_banner_image_url`, `'%/storage/v1/object/public/' || bucket_id || '/' || object_path` desenine uyan canlı bir görsel asset'e eşleşiyorsa, `shop_slides`'a bir satır eklenir (başlık, CTA) ve mode `media` yapılır. Yalnızca `shop_slides` boşsa çalışır.

- [ ] Sözleşme testini yaz. Migration metninde şunları assert eder: `content-video`, `52428800`, `'video/mp4'`, `admin_save_shop_slider`, `has_admin_role()`, `on delete restrict`, `sort_order between 0 and 11`, `sort_order between 0 and 5`. Ayrıca `drop table` ve `truncate` içermediğini doğrular.
- [ ] Testi çalıştır: dosya yok, FAIL.
- [ ] İki migration'ı yaz. Settings'te değerin nasıl saklandığına bak: `site_settings.value` jsonb ise `value #>> '{}'` kullanılır.
- [ ] Testi çalıştır: PASS. Commit.

### Task 2: Video sabitleri ve probe

**Files:**
- Modify: `lib/admin/media.ts`
- Create: `lib/admin/video-probe.ts`
- Test: `tests/video-probe.test.ts`, `tests/media-limits.test.ts` (genişlet)

**Interfaces — Produces:**
- `VIDEO_BUCKET = "content-video"`, `VIDEO_MAX_BYTES = 50 * 1024 * 1024`, `VIDEO_EXTENSIONS = { "video/mp4": "mp4", "video/webm": "webm" }`.
- `MEDIA_MIME_LABELS` içine MP4 ve WebM eklenir. `IMAGE_ACCEPT` (eski `MEDIA_ACCEPT` aynı değer olarak kalır) ve `VIDEO_ACCEPT` tanımlanır.
- `isVideoMime(m: string): boolean`, `mediaKindOf(m: string): "image" | "video"`.
- `MEDIA_FOLDERS` içine `"slider"` eklenir.
- `safeObjectName`, uzantı için `VIDEO_EXTENSIONS`'a da bakar.
- `clientFileProblem(file, kind?: "image" | "video")`: video için 50 MB sınırı ve "Yalnızca MP4 ve WebM videoları yüklenebilir." mesajı.
- `probeVideo(header: ArrayBuffer): "video/mp4" | "video/webm" | null`. MP4 için 4. bayttan itibaren `ftyp`, WebM için `1A 45 DF A3` aranır. `VIDEO_PROBE_BYTES = 64`.

- [ ] Testleri yaz. `probeVideo`: `ftyp` başlığı `video/mp4` döner, EBML başlığı `video/webm` döner, PNG başlığı ve boş buffer `null` döner. `clientFileProblem`: 60 MB video sınırı aşar, 10 MB `video/mp4` geçer, `image/png` video modunda reddedilir.
- [ ] FAIL → uygula → PASS → commit.

### Task 3: Video yükleme akışı ve kütüphane desteği

**Files:**
- Create: `lib/admin/video-upload.ts` (server-only çekirdek: `prepareVideoUpload` ve `finalizeVideoUpload`, Supabase istemcisi argümanla gelir)
- Modify: `app/admin/(protected)/media/actions.ts` (`createVideoUploadAction` ve `finalizeVideoUploadAction` eklenir)
- Create: `components/admin/media/upload-file.ts` (client: `uploadLibraryFile(file, folder?) => Promise<{ok:true, asset}|{ok:false, message}>`; görseli `uploadMediaAction`'a, videoyu imzalı akışa yönlendirir)
- Modify: `components/admin/media/media-uploader.tsx`, `media-picker.tsx` (prop `kind?: "image" | "video" | "any"`, varsayılan `"image"`), `media-thumb.tsx` (videoda `<video preload="metadata" muted>` ve "Video" etiketi), `app/admin/(protected)/media/api/route.ts` (`tur` değerleri: bir MIME, `gorsel` ya da `video`), `lib/admin/queries/media.ts` (`MediaQuery.kind`; `video/%` ya da `image/%` filtresi)
- Test: `tests/video-upload.test.ts`

**Interfaces:**
- `prepareVideoUpload(supabase, { filename, size, type, folder, userId }) => { ok: true, path, token } | { ok: false, kind: "invalid", message } | { ok: false, kind: "failed", error, context }`. `storage.from(VIDEO_BUCKET).createSignedUploadUrl(path)` çağrılır.
- `finalizeVideoUpload(supabase, { path, filename, userId, fetchHead }) => MediaUploadResult`. Yol `^(journal|slider)/\d{4}-\d{2}/[a-z0-9-]+-[0-9a-f]{8}\.(mp4|webm)$` desenine uymalı. `fetchHead(url)` ilk 64 baytı `Range` başlığıyla getirir (test edilebilir olması için enjekte edilir). Boyut `storage.from(...).info(path)` ya da `list` ile alınır. Probe başarısız olursa ya da boyut 50 MB'ı aşarsa nesne silinir. Uzantı probe sonucuyla uyuşmalı. Sonunda `media_assets` satırı eklenir.
- Client akışı: `createVideoUploadAction` → `supabase.storage.from(VIDEO_BUCKET).uploadToSignedUrl(path, token, file)` (tarayıcı istemcisi `lib/supabase/client`) → `finalizeVideoUploadAction`.

- [ ] Testleri yaz (sahte Supabase istemcisiyle). Geçersiz yol reddedilir. Sahte başlık nesneyi siler ve "Dosya içeriği geçerli bir video değil." mesajını döner. Geçerli bir MP4 için satır `bucket_id: "content-video"` ve `mime_type: "video/mp4"` ile eklenir. 60 MB'lık prepare reddedilir.
- [ ] FAIL → uygula → PASS. Bileşenleri bağla, `npx tsc --noEmit` çalıştır → commit.

### Task 4: CSP `media-src`

**Files:** Modify `proxy.ts` (`media-src 'self' <sbOrigin ?? https://*.supabase.co>` ve `blob:`), `tests/security-headers.test.ts`.

- [ ] Test: CSP içinde `media-src 'self'` ve Supabase origin'i bulunur. FAIL → uygula → PASS → commit.

### Task 5: Kullanım tespiti

**Files:** Modify `lib/admin/media.ts` (`MediaUsageKind` içine `"slider"`), `lib/admin/media-usage.ts` (`UsageRows.journalVideo: {id, slug, video_asset_id}[]`, `UsageRows.sliderSlides: {id, media_asset_id, poster_asset_id}[]`; asset id ile eşleşme; HREF `/admin/content`; ifade "slider'da"), `lib/admin/queries/media.ts` (iki ek sorgu, fail closed), `tests/media-usage.test.ts`.

- [ ] Test: günlük videosu ve slayt posteri asset'i kullanımda gösterir. `summariseUsage` "1 slider'da kullanılıyor" der. `deleteBlockedMessage` "(slider)" içerir. FAIL → uygula → PASS → commit.

### Task 6: Günlük videosu

**Files:** Modify `lib/admin/schemas.ts` (`journalEntrySchema`: `video_path` alanı kalkar; `video_asset_id: uuid nullable`, `keep_legacy_video: boolean` eklenir), `lib/admin/journal-fields.ts` (`buildJournalRow(input, legacyVideoPath: string | null)` → `video_path` ve `video_asset_id` yazar; asset seçiliyse `video_path` null), `app/admin/(protected)/journal/actions.ts`, `journal-form.tsx` (yeni `JournalVideoField` client bileşeni: picker `kind="video"`, yükleme, kaldırma, hidden `video_asset_id` ve `keep_legacy_video`), `lib/admin/queries/journal.ts` (detail: `video_asset_id`, `video_bucket`, `video_object_path`), `lib/journal.ts` (select'e `video_bucket` ve `video_object_path` eklenir; `video` = `publicMediaUrl(...)` ya da `video_path`), `app/gunluk/[slug]/page.tsx` (değişmez, `entry.video` kullanır), `tests/admin-journal.test.ts`, `tests/journal-reads.test.ts`.

- [ ] Testler:
  - Formda `name="video_path"` yok; `name="video_asset_id"` var.
  - `buildJournalRow` asset ile `video_path: null` yazar; `keep_legacy_video` ile eski yolu korur; yeni kayıtta yol hep null.
  - `mapJournalRow`, `video_bucket` ve `video_object_path` varken `https://…/storage/v1/object/public/content-video/…` döner, yalnız `video_path` varken onu döner.
- [ ] FAIL → uygula → PASS → commit.

### Task 7: Slider alan modülü ve okuma

**Files:**
- Create: `lib/shop-slider.ts` (saf modül)
- Create: `lib/shop-slider-read.ts` (honestCache ile okuma)
- Modify: `lib/products.ts` (`discountPercent`)
- Test: `tests/shop-slider.test.ts`

**Interfaces — Produces** (`lib/shop-slider.ts`):
- `SLIDER_MAX_SLIDES = 6`, `SLIDER_MAX_FEATURED = 12`, `SLIDER_BELOW_COUNT = 3`, `SLIDER_INTERVAL_MS = 5000`
- `type SliderMode = "off" | "media" | "products"`
- `interface SliderSlide { id; kind: "image" | "video"; src; posterSrc: string | null; headline: string | null; alt: string | null; linkHref: string | null; linkLabel: string | null }`
- `type ShopSliderView = { mode: "media"; slides: SliderSlide[]; below: Product[] } | { mode: "products"; products: Product[] }`
- `resolveSliderView(input: { config: { mode; show_featured_below } | null; slides: SlideRow[]; featured: { product_id; sort_order }[]; products: Product[]; supabaseUrl: string }) => ShopSliderView | null`. Pasif ve eksik ürünler düşer. `media` modunda slayt yoksa `null`. `below` = ilk 3 ürün ve yalnızca `show_featured_below` açıkken.
- `shopSliderSaveSchema` (Zod): `mode`, `show_featured_below`, `slides[] { media_asset_id uuid, poster_asset_id uuid|null, headline ≤80, alt_text ≤200, link_href site-içi '^/[^/]' ≤300 ve `isSafeSettingUrl`'den geçer, link_label ≤30, link çifti }` en fazla 6, `featured uuid[]` en fazla 12 ve tekrarsız, mod kuralları.
- `autoplayInitiallyOn(prefersReducedMotion: boolean): boolean`
- `discountPercent(price: number, original?: number): number | null`. `lib/products.ts`'e eklenir; `Math.round`; geçerli indirim yoksa ya da sonuç 0 ise `null`.
- `lib/shop-slider-read.ts`: `getShopSliderView(): Promise<ShopSliderView | null>`. Tag `SHOP_SLIDER_TAG = "shop-slider"`. Ürünler `getCachedPublicProducts`'tan id eşleşmesiyle alınır. Hata `null` döner.

- [ ] Testler: Review Focus 1, 2, 4, 5'in yanında `discountPercent(450, 520) === 13`, `discountPercent(450, 450) === null`, 13 ürünle şema hata verir, 7 slaytla hata verir, `media` modunda ilk 3 ürün `below` olur.
- [ ] FAIL → uygula → PASS → commit.

### Task 8: Slider admin paneli

**Files:**
- Create: `app/admin/(protected)/content/slider-actions.ts` (`saveShopSliderAction(prev, formData)`: `adminContext("manageContent")`, JSON alanı `payload`, şema, `supabase.rpc("admin_save_shop_slider", …)`, `logAdminAction` (`area: "shop_slider"`), `revalidateTag(SHOP_SLIDER_TAG)`, `revalidatePath("/magaza")`)
- Create: `components/admin/content/shop-slider-editor.tsx` (client)
- Create: `lib/admin/queries/shop-slider.ts` (`loadShopSliderAdmin(supabase)`: config, slaytlar ve asset'leri, öne çıkanlar, aktif ürün listesi)
- Modify: `app/admin/(protected)/content/page.tsx` (`shop_banner` formu kalkar, editör en üste gelir)
- Test: `tests/shop-slider-admin.test.ts` (kaynak sözleşmesi)

- [ ] Testler: content sayfası `group="shop_banner"` içermez, `ShopSliderEditor` içerir. Action `adminContext("manageContent")`, `admin_save_shop_slider` ve `revalidateTag` çağırır. Editörde `kind="any"` picker ve `kind="image"` poster picker bulunur.
- [ ] FAIL → uygula → PASS → `npx tsc --noEmit` → commit.

### Task 9: Mağaza vitrini

**Files:**
- Create: `components/shop/shop-slider.tsx` (client carousel)
- Create: `components/shop/slider-product-slide.tsx`
- Create: `components/shop/featured-products.tsx`
- Modify: `components/shop/product-entry.tsx` (prop `featured?: boolean` → görselin sol üstünde "Öne çıkan" etiketi; `discountPercent` → fiyat satırında "%X indirim")
- Modify: `app/shop/page.tsx` (banner okuması kalkar, `getShopSliderView()` Suspense içinde, `wrap` içinde)
- Test: `tests/shop-slider-ui.test.ts` (kaynak sözleşmesi)

**Davranış:**
- Kap `wrap` içinde. Desktop'ta (≥1320px, `min-[1320px]:`) oklar `-left-14` ve `-right-14` ile dışarıda; daha dar ekranda içeride `left-3` ve `right-3`, yarı saydam daire.
- `overflow-x-auto snap-x snap-mandatory`, slayt `w-full shrink-0 snap-start`.
- 5000 ms `setInterval`: hover, focus-within, `pointerdown` veya `document.hidden` durumunda durur; elle geçişte sıfırlanır; sondan başa sarar.
- Tek bir duraklat/oynat butonu.
- Video: yalnızca etkin slayttaysa ve oynatma açıksa `play()`; aksi halde `pause()`. `saveData` açıksa oynatılmaz.
- Erişilebilirlik: `aria-roledescription="carousel"`, slaytlarda `aria-label="1 / 3"`, sayaç gösterilir.
- Medya oranı `aspect-[4/5] md:aspect-[16/7]`.
- Ürün slaytı: `md:grid-cols-2`, görsel 4:5 sol, sağda "Öne çıkan" (`label text-brand`), kaynak, ad, fiyat, üstü çizili eski fiyat ve "%X indirim", "Ürüne git".
- Medya modunda altta `FeaturedProducts`: `label` "Öne çıkanlar" ve grid ile aynı `ul`; `ProductEntry featured`.

- [ ] Testler:
  - `app/shop/page.tsx`, `getShopSliderView` kullanır ve `ShopHeroBanner` içermez.
  - `shop-slider.tsx` şunları içerir: `SLIDER_INTERVAL_MS`, `aria-roledescription="carousel"`, `snap-mandatory`, `prefers-reduced-motion` (ya da `useReducedMotion`), `document.hidden` ya da `visibilitychange`, `saveData`.
  - `product-entry.tsx`, `discountPercent` ve "Öne çıkan" içerir.
- [ ] FAIL → uygula → PASS → `npm run build` → commit.

### Task 10: Doküman ve son kontrol

**Files:** `docs/content-images-to-storage.md` (video sınırlaması çözüldü notu), `docs/admin-operations.md` (Video ve Mağaza slider'ı bölümleri, sahipsiz yükleme notu).

- [ ] `node tests/support/run-database-free.mjs` (tümü geçer), `npx tsc --noEmit`, `npm run lint`, `npm run build`. Commit.
