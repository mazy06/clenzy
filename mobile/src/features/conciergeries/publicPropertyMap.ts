import type { CatalogProvider } from '@/features/marketplace/api';
import type { PublicClient, PublicProperty } from './publicProfiles';

export interface PublicMapHome { id: number; client: PublicClient; property: PublicProperty }

/** City-only projection: never accept property coordinates or address fields. */
export function publicMapHomes(clients: PublicClient[]): PublicMapHome[] {
  return clients.flatMap(client => client.properties.filter(property => !!property.city?.trim())
    .map(property => ({ client, property }))).map((home, index) => ({ ...home, id: index + 1 }));
}

export function publicHomeMapPins(homes: PublicMapHome[]): CatalogProvider[] {
  return homes.map(({ id, property }) => ({
    id, displayName: property.name, baseCity: property.city.trim(),baseCountryCode:property.countryCode,
    travelRadiusKm: 3, coverageCities: [], languages: [], categoryCodes: [], offers: [],
    verified: false, own: false,
  }));
}
