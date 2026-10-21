import type { ExpressionSpecification } from 'maplibre-gl';

/** Catégories disponibles dans les tuiles OSM Baitly. Les stations n'y distinguent pas train et métro. */
export const MAP_PLACE_CATEGORIES = [
  { id: 'transport', label: 'Gares et métros', kinds: ['station', 'bus_stop', 'ferry_terminal', 'aerodrome'], enabled: true },
  { id: 'groceries', label: 'Supermarchés et épiceries', kinds: ['supermarket', 'convenience', 'bakery'], enabled: false },
  { id: 'restaurants', label: 'Restaurants', kinds: ['restaurant', 'fast_food'], enabled: false },
  { id: 'cafes', label: 'Cafés et bars', kinds: ['cafe', 'bar', 'pub'], enabled: false },
  { id: 'health', label: 'Pharmacies et santé', kinds: ['pharmacy', 'hospital', 'clinic', 'doctors'], enabled: false },
  { id: 'culture', label: 'Culture et visites', kinds: ['attraction', 'museum', 'theatre', 'artwork', 'zoo'], enabled: true },
  { id: 'nature', label: 'Parcs et plein air', kinds: ['beach', 'forest', 'marina', 'park', 'peak', 'garden'], enabled: true },
  { id: 'services', label: 'Services pratiques', kinds: ['toilets', 'drinking_water', 'post_office', 'atm', 'bank', 'parking', 'laundry'], enabled: false },
] as const;

export type MapPlaceCategory = typeof MAP_PLACE_CATEGORIES[number]['id'];
export const DEFAULT_MAP_PLACES: MapPlaceCategory[] = MAP_PLACE_CATEGORIES.filter(c => c.enabled).map(c => c.id);

export function mapPlacesFilter(selected: readonly MapPlaceCategory[]): ExpressionSpecification {
  const kinds = MAP_PLACE_CATEGORIES.filter(c => selected.includes(c.id)).flatMap(c => [...c.kinds]);
  return ['all',
    ['in', ['get', 'kind'], ['literal', kinds]],
    ['>=', ['zoom'], ['coalesce', ['get', 'min_zoom'], 14]],
  ];
}
