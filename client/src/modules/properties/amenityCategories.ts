/**
 * Familles d'équipements Baitly : l'ordre du formulaire et la couleur de leurs icônes.
 *
 * Chaque famille a son propre couple de la palette Baitly : l'encre trace
 * l'icône, le pastel fait sa tuile. On n'utilise jamais la teinte vive seule,
 * car sable et teal sur leur pastel tombent sous 2:1.
 * Contraste de l'encre sur sa tuile, mesuré sur --bui-card :
 *   - au moins 5,1:1 en clair ;
 *   - au moins 4,2:1 en sombre ;
 *   - le seuil d'un pictogramme est de 3:1.
 */

export interface AmenityTone {
  /** Trait de l'icône. */
  ink: string;
  /** Fond de la tuile. */
  soft: string;
}

export type AmenityCategoryKey = 'comfort' | 'kitchen' | 'appliances' | 'outdoor' | 'safetyFamily';

export interface AmenityCategory {
  key: AmenityCategoryKey;
  items: readonly string[];
  tone: AmenityTone;
}

/** Une teinte par famille ; les prestations de ménage reprennent les mêmes. */
export const AMENITY_TONES: Readonly<Record<AmenityCategoryKey, AmenityTone>> = {
  // Bleu marine de la marque ; --bui-screen-icon-bg est ce même bleu à 14 %.
  comfort: { ink: 'var(--bui-navy)', soft: 'var(--bui-screen-icon-bg)' },
  kitchen: { ink: 'var(--bui-warning-ink)', soft: 'var(--bui-warning-soft)' },
  appliances: { ink: 'var(--bui-info-ink)', soft: 'var(--bui-info-soft)' },
  outdoor: { ink: 'var(--bui-success-ink)', soft: 'var(--bui-success-soft)' },
  safetyFamily: { ink: 'var(--bui-destructive-ink)', soft: 'var(--bui-destructive-soft)' },
};

export const AMENITY_CATEGORIES: readonly AmenityCategory[] = [
  { key: 'comfort', items: ['WIFI', 'TV', 'AIR_CONDITIONING', 'HEATING'], tone: AMENITY_TONES.comfort },
  { key: 'kitchen', items: ['EQUIPPED_KITCHEN', 'DISHWASHER', 'MICROWAVE', 'OVEN'], tone: AMENITY_TONES.kitchen },
  { key: 'appliances', items: ['WASHING_MACHINE', 'DRYER', 'IRON', 'HAIR_DRYER'], tone: AMENITY_TONES.appliances },
  { key: 'outdoor', items: ['PARKING', 'POOL', 'JACUZZI', 'GARDEN_TERRACE', 'BARBECUE'], tone: AMENITY_TONES.outdoor },
  { key: 'safetyFamily', items: ['SAFE', 'BABY_BED', 'HIGH_CHAIR'], tone: AMENITY_TONES.safetyFamily },
];

/** Une commodité personnalisée n'appartient à aucune famille : elle reste neutre. */
export const NEUTRAL_AMENITY_TONE: AmenityTone = { ink: 'var(--bui-muted-foreground)', soft: 'var(--bui-muted)' };

/** Rang de la famille, dans l'ordre du formulaire. Les commodités personnalisées passent en dernier. */
function categoryRank(code: string): number {
  const rank = AMENITY_CATEGORIES.findIndex((category) => category.items.includes(code));
  return rank === -1 ? AMENITY_CATEGORIES.length : rank;
}

export function amenityTone(code: string): AmenityTone {
  return AMENITY_CATEGORIES[categoryRank(code)]?.tone ?? NEUTRAL_AMENITY_TONE;
}

/**
 * Regroupe les équipements par famille pour que les couleurs se suivent.
 * Le tri est stable : à l'intérieur d'une famille, l'ordre enregistré est conservé.
 */
export function sortByAmenityCategory(codes: readonly string[]): string[] {
  return [...codes].sort((a, b) => categoryRank(a) - categoryRank(b));
}
