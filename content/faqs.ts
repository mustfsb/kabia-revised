/**
 * Shared questions — the same answers feed the visible accordion
 * (components/faq/faq-list.tsx) and the FAQPage JSON-LD on each page,
 * so the two can never drift apart.
 */
export const faqs = {
  ciftlik: [
    { q: "Organik tarım nedir?", a: "Kimyasal sentetik gübre ve ilaç kullanılmaz; toprağı canlı bir ekosistem olarak değerlendirerek, orman kompostu, kompost çayı ve doğal killerle koruma gibi doğal yöntemlerle üretim yapılır." },
    { q: "Kabia Çiftliği nerede?", a: "Sabırlar Köyü, Kılıçkaya Vadisi, Geyve / Sakarya. 946 Marinada badem ağacımız vardır." },
    { q: "Ürünler nasıl kargoya verilir?", a: "2000₺ üzeri siparişlerde kargo ücretsiz; 2000₺ altında 107,91₺ (HepsiJet, 4 desiye kadar). Hasat tarihli paketle, serin ve kuru yolla gönderilir." },
    { q: "Bademler neden hep aynı büyüklükte değil?", a: "Çünkü organik üretiyoruz. Tek tip kalibre için kimyasal ve standartlama gerekir; bizde ağaç ne verirse o gelir. Küçük ya da içi boş taneler olabilir — kusur değil, doğallığın kanıtıdır." },
  ],
  emanet: [
    { q: "Toprağı emanet olarak neden görüyorsunuz?", a: "Toprak bize ait değil; bizden sonrakilere bırakacağımız bir emanet. Hızlı değil, doğru ve kalıcı üretim — her hasat bir sonraki yılın toprağına bırakılan nottur." },
    { q: "Dışarıdan girdi kullanıyor musunuz?", a: "Hayır. Organik sertifikalı olsa bile gübre anlamıyla dışarıdan bir girdi almıyoruz. Tüm besinler kompost, kompost gübresi ve kompost çayı şeklinde kendi bahçemizden geliyor." },
    { q: "2025'te neden hasat alamadık?", a: "2025 yılında Mart ayında 4 gün süren şiddetli soğuk hava ve don tüm hasadı etkiledi. Ama toprak dinlendi, bize de şunu öğretti: tarım doğaya karşı bir mücadele değil, doğayla birlikte üretmenin yollarını aramaktır." },
  ],
  secki: [
    { q: "Kabia Seçki nedir?", a: "Kendi üretmediğimiz ama üreticisini tanıdığımız, üretim biçimine güvendiğimiz ürünleri seçtiğimiz kapsamdır. Ceviz, fındık, bal ve ıhlamur Kabia Seçki'nin içinde." },
    { q: "Ürünler nasıl seçiliyor?", a: "Her ürünün arkasında üretici, bölge ve hikâye var. Şeffaf olmayan, üreticisini bilmediğimiz ürünü seçmiyoruz." },
  ],
  mutfak: [
    { q: "Geleneksel mutfak nedir?", a: "Erişte, tarhana, salça, sirke — güvendiğimiz üreticilerin elinden, geleneksel yöntemlerle hazırlanan ürünlerdir. Organik sertifikası yoktur." },
    { q: "Ürünler nasıl saklanıyor?", a: "Serin ve kuru yerde, belirtilen süreye kadar. Geleneksel cam kavanoz ve karton paketleme, doğal dokuyu korur." },
  ],
  magaza: [
    { q: "Kargo ücreti ne kadar?", a: "2000₺ üzeri siparişlerde kargo ücretsiz; 2000₺ altında 107,91₺ (HepsiJet). Hasat tarihli paketle, serin ve kuru yolla gönderilir." },
    { q: "Ürünler katkısız mı?", a: "Koruyucu ve katkı maddesi içermez. Organik sertifikalı üretimde bile dışarıdan gübre almıyoruz — girdilerin tamamı kendi bahçemizden." },
    { q: "Stoklar neden kapalı?", a: "Hasat dönemi dışında stok açmıyoruz. Sayfanın sonundaki kutuya e-postanı bırakırsan, ön sipariş açılınca ilk sana yazıyoruz." },
    { q: "İade var mı?", a: "Açılmamış ürünlerde 15 gün içinde iade ve değişim." },
  ],
} as const;

export type FaqGroup = keyof typeof faqs;
