# Mağaza slider'ı ve günlük videosu — tasarım

**Tarih:** 2026-11-17
**Branch:** `feat/shop-slider-journal-video` (worktree `/Users/mustafa/kabia-slider-video`)
**Durum:** Onaylandı (2026-11-17), otomatik kayma ve 12 ürün değişikliğiyle

## Amaç

1. Admin, günlük yazılarına kod değişikliği ve deploy gerekmeden, panelden video ekleyebilsin.
2. `/magaza`'nın en üstünde admin'in tamamen yönettiği bir alan olsun:
   - **Medya slider'ı:** fotoğraf ve/veya video slaytları, sağda ve solda oklar. İstenirse altında 3 öne çıkan ürün gösterilir.
   - **Ürün slider'ı:** medya kullanılmıyorsa slider'ın yerini öne çıkan ürünler alır. Her slaytta bir ürün, aynı oklar, ürün görseli, fiyat ve varsa indirim gösterilir.
   - Öne çıkan ürün kendini belli eder ("Öne çıkan" etiketi).

Tasarım sade ve minimal kalır, sitenin mevcut diliyle uyumludur. Fazlası eklenmez.

## Hedef dışı / anti-hedefler

- Parallax ve büyük geçiş animasyonları. Hareket, 5 saniyede bir yapılan yumuşak bir kaydırmadan ibarettir.
- Yeni bir carousel kütüphanesi veya bağımlılık.
- Üretici mağaza sayfalarında (`/magaza/[üretici]`) slider. Yalnızca `/magaza`'da olur.
- Sayfa kurucusu: renk, yazı tipi ve yerleşim kodda kalır. Admin yalnızca içerik ve seçimleri yönetir.
- Var olan `kaolin` videosunu Storage'a taşımak. Yerel yolu çalışmaya devam eder.
- Slider'ın LCP'yi kötüleştirmesi. İlk slaytın görseli `priority` ile yüklenir; video ilk boyamada poster gösterir.

## Kısıtlar

- **Tek Supabase projesi canlı.** Her şema ve Storage değişikliği bir üretim yazımıdır. Prosedür şöyle: önce canlı durum okunur, etkilenen satırlar repo dışına yedeklenir (`/Users/mustafa/kabia-slider-video-migration/snapshots/`), başlığında ne/neden/geri alma yazan idempotent bir migration uygulanır, canlıda doğrulanır ve hemen commit edilir. `DROP TABLE`, `TRUNCATE`, koşulsuz yazım, `auth.*` ve rol değişikliği yasaktır.
- **Migration'lar geriye uyumlu olmalı.** Üretimde eski kod çalışırken uygulanacakları için yalnızca ekleme yapılır; eski kodun okuduğu hiçbir şey kaldırılmaz.
- **Push yok.** Commit'ler yerelde kalır, deploy'u kullanıcı yapar.
- **`npm test` çalıştırılmaz** (canlı veritabanına yazan testler içerir). Yalnızca `tests/support/run-database-free.mjs` ile veritabanısız suit ve `build`, `typecheck`, `lint` kullanılır.
- Vercel'in istek gövdesi sınırı 4.5 MB, uygulamanın yükleme sınırı 4 MB. Video bu yoldan geçemez.

## Yaklaşımlar

**Slider verisinin nerede duracağı:**

| | Ayrı tablolar (**seçildi**) | `site_settings` içinde JSON |
|---|---|---|
| Medya/ürün bağlantısı | FK. Kullanılan medya silinemez, arşivlenen ürün otomatik düşer | ID'ler metin; kırık referans elle kontrol edilmeli |
| Kayıt | Tek RPC, tek transaction | Ayar satırı güncellemesi |
| İş miktarı | Migration + RPC + kullanım tespiti | Daha az |

Kullanıcı 1. yolu seçti. Ürün galerisi ve günlük galerisi de aynı desenle (atomik kayıt RPC'si) çalışıyor.

**Video yükleme:** Tek mantıklı yol, dosyanın tarayıcıdan doğrudan Storage'a imzalı yükleme adresiyle gönderilmesi. Uygulama sunucusundan geçirmek 4 MB sınırına takılır; Supabase panelinden yüklemek ise medya kütüphanesini ve kullanım takibini atlar.

## Tasarım

### 1. Video altyapısı (günlük ve slider ortak kullanır)

**Bucket.** Yeni public bucket `content-video`: `allowed_mime_types = {video/mp4, video/webm}`, `file_size_limit = 50 MB`. Yazma, `product-media` bucket'ındaki politikaların aynısıyla yalnızca admin'e açık; okuma public. Projenin global yükleme sınırı canlıda okunur. Sınır 50 MB'tan düşükse bucket limiti ona indirilir ve arayüz metni buna göre yazılır.

**Katalog.** `media_assets.mime_type` CHECK'i `video/mp4` ve `video/webm`'i de kabul edecek şekilde genişletilir. Video satırlarında `bucket_id = 'content-video'`; `width` ve `height` boş kalabilir. `alt_text`, video için ekran okuyucuya verilen açıklama olarak kullanılır.

**Yükleme akışı:**
1. `createVideoUploadAction({ filename, size, type })`: `adminContext("manageMedia")` ile yetki kontrol edilir. Bildirilen tür ve boyut doğrulanır, `safeObjectName` ile yol üretilir (`journal/` veya `slider/` klasörü, `YYYY-MM/`), ardından `createSignedUploadUrl` çağrılır.
2. Tarayıcı `uploadToSignedUrl` ile dosyayı gönderir ve yükleme ilerlemesi gösterilir.
3. `finalizeVideoUploadAction({ path })`: nesnenin ilk baytları okunur. MP4 için `ftyp` kutusu, WebM için EBML başlığı aranır. Gerçek boyut Storage metadata'sından alınır. Kontrol geçerse `media_assets` satırı eklenir ve denetim kaydı yazılır. Geçmezse nesne silinir ve "Dosya içeriği geçerli bir video değil" denir.

Saf kontrol `lib/admin/video-probe.ts` içinde, test edilebilir biçimde durur (`image-probe.ts` eşleniği).

Kurucu için notlar:
- İmzalı adres admin'in kendi oturumuyla üretilir. Service-role anahtarı kullanılmaz; bunun için bucket'ta admin `insert` politikası gerekir.
- Medya kütüphanesinin silme ve URL üretme kodu bugün `MEDIA_BUCKET` sabitini varsayıyor. Satırın kendi `bucket_id`'sini kullanacak hale getirilmelidir.
- Başlayıp finalize edilmeyen bir yükleme Storage'da sahipsiz nesne bırakabilir. Bu kabul edilir ve operasyon dokümanında not edilir; otomatik temizlik bu kapsamda yok.

**CSP.** `proxy.ts` içine `media-src 'self' https://<supabase-host>` eklenir; `tests/security-headers.test.ts` buna göre güncellenir. İmzalı yükleme Supabase origin'ine gider; bu origin `connect-src`'de zaten var, canlıda doğrulanır.

**Medya kütüphanesi.** `/admin/media` ızgarasında video kutucuğu (`<video preload="metadata">` ve küçük bir "Video" etiketi), tür filtresine "Video" seçeneği ve yükleyicide video desteği eklenir. Video sürükle-bırakla veya "dosya seçin" ile yüklenir; 50 MB sınırı burada da yazılır. `MediaPicker`'a `kind: "image" | "video"` parametresi eklenir; görsel seçen yerler bugünkü gibi yalnızca görsel görür.

**Kullanım tespiti.** `media-usage.ts` iki yeni kaynakla genişler: günlük videosu (`journal_entries.video_asset_id`) ve slider (`shop_slides.media_asset_id`, `poster_asset_id`). Yeni tür `slider`, bağlantısı `/admin/content`. Kullanımdaki bir medya bugünkü gibi silinemez. Yeni sorgular hata verirse tespit kapalı başarısız olur (fail closed).

### 2. Günlük videosu

- **Migration:** `journal_entries.video_asset_id uuid null references media_assets(id) on delete restrict`. `video_path` kalır; eski kod ve mevcut kaolin kaydı onu okumaya devam eder.
- **Admin formu** (`journal-form.tsx`): serbest metin "video yolu" alanı kalkar, yerine "Video" bölümü gelir: **Medyadan seç** (yalnızca video), **Yeni video yükle**, **Kaldır**. Eski yerel yolu olan bir kayıtta "Mevcut video: yerel dosya (…)" yazar ve "Kaldır" seçeneği sunulur. Yeni bir yerel yol yazılamaz.
- **Kayıt:** `video_asset_id` var olan, silinmemiş bir video asset'i olmalıdır (şema ve sunucu kontrolü). Asset seçilirse `video_path` boşaltılır; ikisi aynı anda dolu olamaz.
- **Görüntüleme** (`/gunluk/[slug]`): asset varsa onun public URL'si, yoksa `video_path` kullanılır. Oynatıcı bugünkü gibi `controls`, `playsInline`, `preload="none"` ve aynı görünümle kalır.

### 3. Mağaza slider'ı — veri

**Migration.** Üç tablo ve bir RPC:

- `shop_slider_config`: tek satır (`id boolean primary key default true check (id)`).
  - `mode text not null default 'off'`, değerleri `off | media | products`
  - `show_featured_below boolean not null default false` (yalnızca `media` modunda anlamlı)
  - `updated_at`, `updated_by`
- `shop_slides`: medya slaytları, en fazla 6.
  - `media_asset_id uuid not null references media_assets on delete restrict`: görsel veya video
  - `poster_asset_id uuid null references media_assets on delete restrict`: video için isteğe bağlı kapak görseli
  - `headline text null` (≤ 80), `alt_text text null` (≤ 200)
  - `link_href text null`, `link_label text null` (≤ 30); ikisi birlikte dolu ya da birlikte boş. `link_href` site içi bir yol (`/…`) olmalıdır; mevcut `url-settings` kuralları uygulanır.
  - `sort_order int not null`
- `shop_featured_products`: `product_id uuid not null references products on delete cascade unique`, `sort_order int not null check (sort_order between 0 and 11) unique`. En fazla 12 ürün. Ürün modunda hepsi slayttır; medya modunda ilk 3'ü slider'ın altında gösterilir.
- `admin_save_shop_slider(p_mode, p_show_featured_below, p_slides jsonb, p_featured uuid[])`: `security definer`. Gövdede `has_admin_role` ve `manageContent` yetkisi yeniden türetilir (mevcut RPC'lerin deseni). Dördü tek transaction'da yazılır. Kontroller:
  - slayt sayısı ≤ 6
  - medya asset'leri var ve silinmemiş
  - poster bir görsel
  - ürünler aktif ve sayıları ≤ 12
  - `mode = 'products'` iken en az 1 ürün, `mode = 'media'` iken en az 1 slayt

  Denetim kaydı önce/sonra durumuyla yazılır.
- **RLS:** herkes okuyabilir, admin yazabilir. Yetkiler `journal_entries` gibi daraltılır.

**Mevcut banner.** Slider, `shop_banner` banner'ının yerini alır. Migration, banner açıksa ve görseli kütüphanedeki bir asset'e eşleşiyorsa onu ilk görsel slayt olarak ekler: başlık banner başlığından, link CTA'dan gelir, `mode = 'media'` olur. Eşleşmiyorsa slider `off` başlar ve migration raporu bunu not eder. `site_settings` içindeki `shop_banner_*` satırları silinmez (eski kod okuyor). Yeni kod onları okumaz, `/admin/content`'teki banner formu kalkar.

**Okuma.** `lib/shop-slider.ts`, `getCachedShopSlider()`. `honest-cache` deseniyle hata ile boş durumu ayırır. Okuma hata verirse slider hiç çizilmez ve mağaza bugünkü gibi açılır; sahte içerik gösterilmez. Kayıt `revalidateTag` ile `/magaza`'yı tazeler.

### 4. Mağaza slider'ı — görünüm

Konum, sayfanın en üstüdür: `PageShell` içinde, "Mağaza" başlığından önce. Bugünkü banner yerini alır, başlığın üst boşluğu da bugünkü banner'lı hali gibi davranır.

**Genişlik ve hiza.** Slider, ürün grid'iyle aynı `wrap` kabının içindedir (en fazla 1200px, aynı yan boşluklar). Sol kenarı ilk ürün kartının sol kenarıyla, sağ kenarı son kartın sağ kenarıyla hizalıdır.

```
 desktop (≥1320px, oklar boşlukta)
   ‹  ┌────────────────────────────────────────────┐  ›
      │                 slayt                       │
      └────────────────────────────────────────────┘
      ┌─────────┐  ┌─────────┐  ┌─────────┐   ← grid ile aynı kenarlar
```

**Oklar.** Slider'ın dışında, sağ ve soldaki boşlukta, dikeyde ortalı durur. Ekran bunlara yer bırakmayacak kadar darsa (yaklaşık 1320px altı, mobil dahil) oklar slaytın iç kenarına, yarı saydam küçük daire butonlar olarak biner. Tek slayt varsa ok gösterilmez. Son slayttan sonra başa döner (otomatik kayma için).

**Davranış.** Yatay `scroll-snap` kabı kullanılır. Dokunmatikte kaydırma doğal çalışır; oklar bir slayt ilerletir.

**Otomatik kayma.** Slider her 5 saniyede bir slayt ilerler. Bu, medya modunda medya slaytları için, ürün modunda ürün slaytları için geçerlidir. Medya modunda slider'ın altındaki 3 öne çıkan ürün sabit kartlardır, kaymaz. Kullanıcı imleçle üstüne geldiğinde, klavyeyle odaklandığında, dokunarak kaydırdığında veya sekme görünmezken zamanlayıcı durur. Elle geçişten sonra 5 saniye yeniden başlar. WCAG 2.2.2 için slider'da tek bir oynat/duraklat butonu bulunur; video slaytları da bu butonla durur. `prefers-reduced-motion` açıksa otomatik kayma kapalı başlar. Erişilebilirlik: `aria-roledescription="carousel"`, her slayt "1 / 3" etiketli, oklar `aria-label` taşır ve klavyeyle kullanılabilir. `prefers-reduced-motion` açıkken kaydırma animasyonsuz olur. Küçük bir "1 / 3" sayacı slaytın alt köşesinde durur; nokta dizisi yoktur.

**Medya slaytı.** Oran desktop'ta 16:7, mobilde 4:5; `object-cover`. Başlık veya link varsa alt kısma hafif bir koyu geçiş gelir (bugünkü banner'ın geçişi) ve üstüne başlık ile tek bir buton yerleşir. İkisi de yoksa geçiş de olmaz, yalnızca medya görünür.

Video slayt etkinken ve ekrandayken `muted loop playsInline autoplay` oynar, değilse duraklar (IntersectionObserver). `prefers-reduced-motion` veya `saveData` açıksa video oynamaz; poster görünür, poster yoksa videonun ilk karesi (`preload="metadata"`). Ayrı bir video butonu yoktur; slider'ın oynat/duraklat butonu videoyu da durdurur.

**Ürün slaytı** (`products` modu):

```
 ┌──────────────────────┬─────────────────────────────┐
 │                      │  ÖNE ÇIKAN                  │
 │    ürün görseli      │  Kabia Çiftliği             │
 │       (4:5)          │  Kabuklu Badem              │
 │                      │  ₺450   ̶₺̶5̶2̶0̶   %13 indirim  │
 │                      │  Ürüne git →                │
 └──────────────────────┴─────────────────────────────┘
```

Desktop'ta görsel solda, bilgi sağda; mobilde görsel üstte. Slayt yüksekliği medya slaytıyla aynı bant içinde kalır. "Öne çıkan" mevcut `label` stilinde, marka renginde yazılır. Kaynak satırı, ad ve fiyat `ProductEntry` ile aynı hiyerarşidedir. İndirim varsa (`originalPrice > price`) eski fiyat üstü çizili, yanında "%X indirim" gösterilir; oran tam sayıya yuvarlanır. Stokta yoksa mevcut "Stokta yok" rozeti görünür. Tüm slayt ürün sayfasına linklidir.

**Medyanın altındaki öne çıkan ürünler** (`media` modu ve `show_featured_below`): slider'ın hemen altında, ana grid ile aynı 3'lü yapıda, `ProductEntry` kartları. Kartlarda görselin sol üstünde küçük "Öne çıkan" etiketi ve indirim varsa "%X indirim" yazar. "Stokta yok" rozeti zaten varsa ikisi çakışmaz, ayrı köşelere yerleşir. Bölüm başlığı yalnızca "Öne çıkanlar" etiketidir. Bu ürünler aşağıdaki ana listede de normal yerlerinde kalır.

İndirim oranı kartı genelleştirilerek eklenir; yani ana grid kartlarında da indirimde "%X" görünür. Bu, "indirim belirtilsin" isteğinin doğal uzantısıdır.

### 5. Admin — `/admin/content` "Mağaza slider'ı" paneli

Banner formunun yerine gelir:

- **Gösterim:** Kapalı · Medya slider'ı · Öne çıkan ürünler (radyo).
- **Slaytlar** (medya modunda): **Medyadan seç** (görsel ve video), **Yeni yükle**. Liste satırlarında küçük önizleme, başlık, link yolu, buton yazısı, alt metin, video için "Kapak görseli seç", **Yukarı / Aşağı**, **Kaldır** yer alır. En fazla 6 slayt. Galeri editörünün satır deseni kullanılır.
- **Öne çıkan ürünler:** en fazla 12 ürün, aranabilir seçici (yalnızca aktif ürünler), sıralama ve kaldırma. Medya modunda "Slider'ın altında göster" anahtarı bulunur ve listenin ilk 3 ürününün gösterileceği yazılır.
- **Kaydet:** tek RPC ile kaydedilir. Doğrulama hataları alan alan gösterilir, seçimler kaybolmaz. Ayrıca "Mağazada görüntüle" linki bulunur.

Mevcut ana sayfa seçkisi (`IntroProductsForm`, `is_featured`) değişmez. O ana sayfanın, bu mağazanın seçimidir ve paneldeki metinler ikisini karıştırmayacak şekilde yazılır.

### 6. Testler (veritabanısız)

- `video-probe`: MP4/WebM başlıkları, sahte uzantı, boş dosya.
- Slider seçici mantığı (`lib/shop-slider.ts`): mod kuralları, boş ve hata durumu, pasif ürünlerin düşmesi, indirim oranı yuvarlama.
- Şema doğrulama: slayt sayısı, link çifti, site içi link, ürün sayısı.
- `media-usage`: slider ve günlük videosu kullanımı silmeyi engeller.
- CSP `media-src`; günlük formu sözleşmesi (yerel yol yazılamaz); mağaza sayfasında banner'ın artık okunmadığı.
- Mevcut `shop-banner` testleri: banner mantığı yeni slayt doğrulamasında (görsel host kuralı) kullanılmaya devam ettiği ölçüde korunur.

Canlı doğrulama, migration'lardan sonra salt okunur sorgularla yapılır. Admin akışı (yükleme, kayıt) kullanıcının oturumu gerektiği için kullanıcıyla birlikte veya kullanıcı tarafından denenir. Bu, raporda açıkça belirtilir.

### 7. Teslim sırası (commit'ler)

1. Video altyapısı migration'ı (bucket, `media_assets` CHECK) + CSP + video-probe + yükleme akışı + kütüphane desteği
2. Günlük videosu (migration, form, görüntüleme, kullanım tespiti)
3. Slider migration'ı + RPC + okuma katmanı
4. Slider admin paneli
5. Mağaza görünümü (slider, ürün slaytı, öne çıkanlar, indirim oranı)
6. Dokümantasyon: `docs/content-images-to-storage.md` "known limitation" bölümü ve `docs/admin-operations.md`

## Kurucuya bırakılanlar

Bileşen dosya adları, sorgu ayrıntıları, tam Tailwind sınıfları (mevcut tokenlarla), ok ikonları (`lucide-react`) ve ilerleme göstergesinin görünümü.

## Kararlar (kullanıcı onayladı)

1. Kullanıcı kararı: slaytlar 5 saniyede bir otomatik kayar (medya ve ürün modunda); altındaki 3 ürün kaymaz.
2. Kullanıcı kararı: ürün slider'ında en fazla 12 ürün. Medya modunda altta listenin ilk 3'ü gösterilir (benim kararım: tek liste).
3. En fazla 6 medya slaytı.
4. Video sınırı 50 MB, MP4/WebM.
5. Mevcut banner slider'a dönüştürülür (koşullar 3. bölümde).
6. İndirim oranı ana grid kartlarında da görünür.
7. Slider yalnızca `/magaza`'da olur.
8. Öne çıkan ürünler ana listede de kalır.
