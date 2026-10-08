/** Copy specific to the public demonstration controls. PMS rows receive the same data labels as the app. */
const fr = {
  map: "Carte des interventions",
  oneInThisZone: "1 intervention dans cette zone",
  hint: "Sélectionnez un logement ou une intervention.",
  empty: "Aucune mission ne correspond à votre recherche.",
  loading: "Chargement de la carte",
  pause: "Mettre la démonstration en pause",
  play: "Reprendre la démonstration",
};
type MapCopy = typeof fr;
const en: MapCopy = {
  map: "Jobs map",
  oneInThisZone: "1 job in this area",
  hint: "Select a property or a job.",
  empty: "No jobs match your search.",
  loading: "Loading map",
  pause: "Pause demonstration",
  play: "Resume demonstration",
};
const ar: MapCopy = {
  map: "خريطة المهام",
  oneInThisZone: "مهمة واحدة في هذا النطاق",
  hint: "اختر وحدة أو مهمة.",
  empty: "لا توجد مهام تطابق بحثك.",
  loading: "جارٍ تحميل الخريطة",
  pause: "إيقاف العرض مؤقتًا",
  play: "استئناف العرض",
};
export const interventionsMapCopy: Record<string, MapCopy> = { fr, en, ar };
