/**
 * Source unique de verite des commodites Baitly built-in (frontend).
 *
 * Synchrone avec :
 *   - le formulaire PropertyForm (PropertyFormDetails.tsx)
 *   - les i18n keys properties.amenities.items.*
 *   - le mapping backend AIRBNB_AMENITY_TO_CLENZY (ChannexImportService.java)
 *
 * Etendable au runtime via les CustomAmenity de l'organisation
 * (cf. amenitiesManagementApi.ts).
 */

export type AmenityCategory =
  | 'comfort'
  | 'kitchen'
  | 'appliances'
  | 'outdoor'
  | 'safetyFamily'
  | 'custom';

export interface AmenityDefinition {
  code: string;
  category: AmenityCategory;
  /** Cle i18n (sans le prefixe properties.amenities.items.). */
  i18nKey: string;
}

/** Liste statique des commodites built-in (ordre = ordre d'affichage). */
export const BUILT_IN_AMENITIES: ReadonlyArray<AmenityDefinition> = [
  // Comfort
  { code: 'WIFI',              category: 'comfort',      i18nKey: 'WIFI' },
  { code: 'TV',                category: 'comfort',      i18nKey: 'TV' },
  { code: 'AIR_CONDITIONING',  category: 'comfort',      i18nKey: 'AIR_CONDITIONING' },
  { code: 'HEATING',           category: 'comfort',      i18nKey: 'HEATING' },
  // Kitchen
  { code: 'EQUIPPED_KITCHEN',  category: 'kitchen',      i18nKey: 'EQUIPPED_KITCHEN' },
  { code: 'DISHWASHER',        category: 'kitchen',      i18nKey: 'DISHWASHER' },
  { code: 'MICROWAVE',         category: 'kitchen',      i18nKey: 'MICROWAVE' },
  { code: 'OVEN',              category: 'kitchen',      i18nKey: 'OVEN' },
  // Appliances
  { code: 'WASHING_MACHINE',   category: 'appliances',   i18nKey: 'WASHING_MACHINE' },
  { code: 'DRYER',             category: 'appliances',   i18nKey: 'DRYER' },
  { code: 'IRON',              category: 'appliances',   i18nKey: 'IRON' },
  { code: 'HAIR_DRYER',        category: 'appliances',   i18nKey: 'HAIR_DRYER' },
  // Outdoor
  { code: 'PARKING',           category: 'outdoor',      i18nKey: 'PARKING' },
  { code: 'POOL',              category: 'outdoor',      i18nKey: 'POOL' },
  { code: 'JACUZZI',           category: 'outdoor',      i18nKey: 'JACUZZI' },
  { code: 'GARDEN_TERRACE',    category: 'outdoor',      i18nKey: 'GARDEN_TERRACE' },
  { code: 'BARBECUE',          category: 'outdoor',      i18nKey: 'BARBECUE' },
  // Safety / family
  { code: 'SAFE',              category: 'safetyFamily', i18nKey: 'SAFE' },
  { code: 'BABY_BED',          category: 'safetyFamily', i18nKey: 'BABY_BED' },
  { code: 'HIGH_CHAIR',        category: 'safetyFamily', i18nKey: 'HIGH_CHAIR' },
] as const;

export const AMENITY_CATEGORY_LABELS: Record<AmenityCategory, string> = {
  comfort:      'Confort',
  kitchen:      'Cuisine',
  appliances:   'Électroménager',
  outdoor:      'Extérieur',
  safetyFamily: 'Sécurité & famille',
  custom:       'Custom',
};
