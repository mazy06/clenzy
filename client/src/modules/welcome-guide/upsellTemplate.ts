/**
 * Catalogue de services payants « de base » suggérés à l'hôte, repris du template
 * Baitly (`wb-data.jsx` → `WB.services`). Affichés dans l'onglet « Services payants » :
 * un clic pré-remplit l'éditeur (type, titre, prix, description) que l'hôte modifie,
 * complète puis enregistre. L'icône (registre lucide partagé) sert à la vignette.
 */

export interface UpsellSuggestion {
  type: string; // cf. UpsellType backend (EARLY_CHECKIN, LATE_CHECKOUT, …)
  icon: string; // nom d'icône lucide (cf. guideIcons)
  title: string;
  price: number;
  currency: string;
  description: string;
}

type Lang = 'fr' | 'en' | 'ar';

const SUGGESTIONS: Record<Lang, UpsellSuggestion[]> = {
  fr: [
    { type: 'EARLY_CHECKIN', icon: 'door-open', title: 'Arrivée anticipée', price: 30, currency: 'EUR', description: 'Accédez au logement plus tôt, selon disponibilité.' },
    { type: 'LATE_CHECKOUT', icon: 'clock', title: "Départ tardif (jusqu'à 14h)", price: 35, currency: 'EUR', description: 'Profitez du logement plus longtemps, sous réserve de disponibilité.' },
    { type: 'CLEANING', icon: 'sparkles', title: 'Ménage supplémentaire', price: 60, currency: 'EUR', description: 'Idéal pour les séjours prolongés.' },
    { type: 'BREAKFAST', icon: 'croissant', title: 'Panier petit-déjeuner', price: 25, currency: 'EUR', description: 'Viennoiseries, jus frais et fruits livrés.' },
    { type: 'TRANSFER', icon: 'car-front', title: 'Transfert aéroport privé', price: 75, currency: 'EUR', description: 'Berline avec chauffeur, sur réservation.' },
    { type: 'PARKING', icon: 'parking-circle', title: 'Place de parking', price: 15, currency: 'EUR', description: 'Stationnement réservé près du logement.' },
  ],
  en: [
    { type: 'EARLY_CHECKIN', icon: 'door-open', title: 'Early check-in', price: 30, currency: 'EUR', description: 'Access the place earlier, subject to availability.' },
    { type: 'LATE_CHECKOUT', icon: 'clock', title: 'Late check-out (until 2pm)', price: 35, currency: 'EUR', description: 'Enjoy the place longer, subject to availability.' },
    { type: 'CLEANING', icon: 'sparkles', title: 'Extra cleaning', price: 60, currency: 'EUR', description: 'Ideal for longer stays.' },
    { type: 'BREAKFAST', icon: 'croissant', title: 'Breakfast basket', price: 25, currency: 'EUR', description: 'Pastries, fresh juice and fruit delivered.' },
    { type: 'TRANSFER', icon: 'car-front', title: 'Private airport transfer', price: 75, currency: 'EUR', description: 'Chauffeured sedan, on request.' },
    { type: 'PARKING', icon: 'parking-circle', title: 'Parking space', price: 15, currency: 'EUR', description: 'Reserved parking near the place.' },
  ],
  ar: [
    { type: 'EARLY_CHECKIN', icon: 'door-open', title: 'تسجيل وصول مبكّر', price: 30, currency: 'EUR', description: 'ادخل المسكن مبكراً، حسب التوفّر.' },
    { type: 'LATE_CHECKOUT', icon: 'clock', title: 'مغادرة متأخّرة (حتى 2 ظهراً)', price: 35, currency: 'EUR', description: 'استمتع بالمسكن وقتاً أطول، حسب التوفّر.' },
    { type: 'CLEANING', icon: 'sparkles', title: 'تنظيف إضافي', price: 60, currency: 'EUR', description: 'مثالي للإقامات الطويلة.' },
    { type: 'BREAKFAST', icon: 'croissant', title: 'سلّة فطور', price: 25, currency: 'EUR', description: 'معجّنات وعصير طازج وفواكه تُوصَّل إليك.' },
    { type: 'TRANSFER', icon: 'car-front', title: 'نقل خاص من المطار', price: 75, currency: 'EUR', description: 'سيارة مع سائق، عند الطلب.' },
    { type: 'PARKING', icon: 'parking-circle', title: 'موقف سيارة', price: 15, currency: 'EUR', description: 'موقف محجوز قرب المسكن.' },
  ],
};

/** Suggestions de services de base dans la langue de l'app (fallback fr). */
export function upsellSuggestions(lang: string): UpsellSuggestion[] {
  return SUGGESTIONS[(lang as Lang)] ?? SUGGESTIONS.fr;
}
