import type { PropertyDetailsData } from '../../hooks/usePropertyDetails';

// Estimation de ménage de la fiche logement : même barème que
// CleaningPriceEstimator (type Standard, coefficient 1,0), sans appel serveur.

const SURFACE_BASE_PRICE: { maxSurface: number | null; base: number }[] = [
  { maxSurface: 30, base: 35 },
  { maxSurface: 50, base: 45 },
  { maxSurface: 70, base: 55 },
  { maxSurface: 100, base: 70 },
  { maxSurface: 150, base: 90 },
  { maxSurface: null, base: 110 },
];

const SURCHARGES = {
  perBedroom: 5,
  perBathroom: 4,
  perFloor: 8,
  exterior: 12,
  laundry: 8,
  perGuestAbove4: 3,
} as const;

function surfaceBasePrice(sqm: number): number {
  for (const tier of SURFACE_BASE_PRICE) {
    if (tier.maxSurface === null || sqm <= tier.maxSurface) return tier.base;
  }
  return SURFACE_BASE_PRICE[SURFACE_BASE_PRICE.length - 1].base;
}

/** Prix d'un ménage Standard, arrondi à 5 €, 30 € au minimum ; `null` sans surface ni prix de base. */
export function estimateCleaningPrice(property: PropertyDetailsData): number | null {
  const sqm = property.surfaceArea ?? 0;
  const basePrice = property.cleaningBasePrice;
  const hasBasePrice = basePrice != null && basePrice > 0;
  if (sqm <= 0 && !hasBasePrice) return null;

  const bedrooms = property.bedrooms ?? 1;
  const bathrooms = property.bathrooms ?? 1;
  const maxGuests = property.maxGuests ?? 2;
  const floors = property.numberOfFloors;

  let surcharge = 0;
  surcharge += Math.max(0, bedrooms - 1) * SURCHARGES.perBedroom;
  surcharge += Math.max(0, bathrooms - 1) * SURCHARGES.perBathroom;
  if (floors != null && floors > 1) surcharge += (floors - 1) * SURCHARGES.perFloor;
  if (property.hasExterior) surcharge += SURCHARGES.exterior;
  if (property.hasLaundry) surcharge += SURCHARGES.laundry;
  if (maxGuests > 4) surcharge += (maxGuests - 4) * SURCHARGES.perGuestAbove4;

  const raw = (hasBasePrice ? basePrice : surfaceBasePrice(sqm)) + surcharge;
  return Math.max(30, Math.round(raw / 5) * 5);
}

/** « 3h40 », « 2h », « 45 min ». */
export function formatCleaningDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}
