import type { LucideIcon } from 'lucide-react';
import {
  Utensils,
  Coffee,
  Wine,
  ShoppingCart,
  Cross,
  Bus,
  Landmark,
  Waves,
  ShoppingBag,
  Stethoscope,
  MapPin,
} from 'lucide-react';

/**
 * Catalogue des catégories de points d'intérêt « autour de moi ».
 * Source unique partagée par l'admin (édition) et la page guest (carte + liste) :
 * id stable (persisté), couleur du pin, icône lucide, et labels fr/en/ar
 * (la page guest est standalone et n'utilise pas i18next).
 */
export type PoiLang = 'fr' | 'en' | 'ar';

export interface PoiCategoryDef {
  id: string;
  color: string;
  Icon: LucideIcon;
  labels: Record<PoiLang, string>;
}

export const POI_CATEGORIES: PoiCategoryDef[] = [
  { id: 'RESTAURANT', color: '#C97A7A', Icon: Utensils, labels: { fr: 'Restaurants', en: 'Restaurants', ar: 'مطاعم' } },
  { id: 'CAFE', color: '#D4A574', Icon: Coffee, labels: { fr: 'Cafés', en: 'Cafés', ar: 'مقاهي' } },
  { id: 'BAR', color: '#9B6B8A', Icon: Wine, labels: { fr: 'Bars', en: 'Bars', ar: 'حانات' } },
  { id: 'GROCERY', color: '#4A9B8E', Icon: ShoppingCart, labels: { fr: 'Commerces', en: 'Groceries', ar: 'متاجر' } },
  { id: 'PHARMACY', color: '#C0504D', Icon: Cross, labels: { fr: 'Pharmacies', en: 'Pharmacies', ar: 'صيدليات' } },
  { id: 'TRANSPORT', color: '#7BA3C2', Icon: Bus, labels: { fr: 'Transports', en: 'Transport', ar: 'مواصلات' } },
  { id: 'ATTRACTION', color: '#6B8A9A', Icon: Landmark, labels: { fr: 'À visiter', en: 'Attractions', ar: 'معالم' } },
  { id: 'BEACH', color: '#4FB3BF', Icon: Waves, labels: { fr: 'Plages & nature', en: 'Beaches & nature', ar: 'شواطئ وطبيعة' } },
  { id: 'SHOPPING', color: '#D08C60', Icon: ShoppingBag, labels: { fr: 'Shopping', en: 'Shopping', ar: 'تسوق' } },
  { id: 'HEALTH', color: '#5B8C5A', Icon: Stethoscope, labels: { fr: 'Santé', en: 'Health', ar: 'صحة' } },
  { id: 'OTHER', color: '#8A8A8A', Icon: MapPin, labels: { fr: 'Autres', en: 'Other', ar: 'أخرى' } },
];

const BY_ID: Record<string, PoiCategoryDef> = Object.fromEntries(POI_CATEGORIES.map((c) => [c.id, c]));

export function poiCategory(id: string): PoiCategoryDef {
  return BY_ID[id] ?? BY_ID.OTHER;
}

export function poiLabel(id: string, lang: string): string {
  const cat = poiCategory(id);
  return cat.labels[lang as PoiLang] ?? cat.labels.en;
}
