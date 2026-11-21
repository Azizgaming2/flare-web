export const loadingPhrases = {
  az: [
    "Düşünür",
    "Hazırlanır",
    "Dərindən Düşünür",
    "İtiləyir",
    "Az Qaldı",
    "Yazır",
    "Flare Triptium",
    "Axtarılır..",
    "Ceyranbatanı Gəzir",
    "Başladılır",
    "Cavab Alınarkən Xəta baş Verdi!",
    "Çəkir",
    "Birazda Gözləyin",
    "Deyəsən Olmur",
  ],
  en: [
    "Thinking",
    "Getting Ready",
    "Musing",
    "Honing",
    "Almost Ready",
    "Writing",
    "Drawing",
    "Wait Little Bit",
    "I Think It Didn't Work",
  ],
};

export function getRandomPhrase(lang) {
  const list = loadingPhrases[lang] || loadingPhrases.en;
  return list[Math.floor(Math.random() * list.length)];
}