/**
 * Static copy for the standalone brand page (/ciftlik)
 * and the soil section now living on /ciftlik. Same convention as
 * content/homepage.ts: every fact here is either taken directly from the
 * KABIA 2.0 brief's Appendix A copy blocks, or already established
 * elsewhere in this codebase (content/homepage.ts) — nothing invented.
 */

export const soil = {
  eyebrow: "Toprak",
  title: "Her şey toprağın altında başlar.",
  body: "Toprağı yalnızca ağacın üzerinde durduğu yer olarak görmüyoruz. Toprak canlıdır. İçindeki yaşam, su, organik madde, kökler, mantarlar, bakteriler ve bitkiler birlikte bir sistem oluşturur.",
  tags: ["Toprak örtüsü", "Organik madde", "Mikrobiyal yaşam", "Su", "Biyolojik mücadele"],
  practice: {
    doTitle: "Ne yapıyoruz?",
    doText:
      "Toprağı gözlemliyoruz. Organik maddeyi destekliyoruz. Bitki örtüsünü korumaya çalışıyoruz. Biyolojik yaşamı destekliyoruz. Doğal ve ekolojik yöntemleri araştırıyor ve uyguluyoruz. Her sezon yeniden öğreniyoruz.",
    dontTitle: "Ne yapmıyoruz?",
    dontText:
      "Üretimi yalnızca tonaj olarak görmüyoruz. Her böceği düşman kabul etmiyoruz. Bahçeyi steril bir alan haline getirmeye çalışmıyoruz. Toprağı gereksiz yere rahatsız etmek istemiyoruz. Doğayı kontrol edebileceğimizi düşünmüyoruz.",
  },
  closing: "Doğayı yenmeye değil, onunla birlikte üretmeye çalışıyoruz.",
} as const

export const farm = {
  eyebrow: "Sabırlar Köyü — Geyve, Sakarya",
  title: "Çiftlik",
  intro: [
    "Her şey bir badem bahçesinde başladı.",
    "Geyve'nin Sabırlar köyünde 19 dönümlük bir bahçede, toprağı yalnızca ürün yetiştirilen bir alan olarak değil, yaşayan bir ekosistem olarak görerek üretmeye çalışıyoruz.",
  ],
  stats: [
    { value: "19", label: "Dönüm" },
    { value: "946", label: "Badem ağacı" },
  ],
  // Same six-step process already established on the homepage (content/homepage.ts → process),
  // reused here rather than re-described, since this page is specifically about the farm.
  approachIntro:
    "Üretimi başkasına devretmiyoruz. Bahçenin bakımından hasada, kurutmadan hazırlığa kadar her adım aynı elden geçer.",
} as const
