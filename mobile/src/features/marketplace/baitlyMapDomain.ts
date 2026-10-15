import type { CatalogProvider } from './api';

export interface MapPosition { latitude: number; longitude: number }
export interface ProviderMapPoint extends MapPosition { id: number; zones: MapPosition[]; radiusKm: number | null }
export function mapCityKey(city:string,country?:string|null){return country?`${city.trim()}|${country.toUpperCase()}`:city.trim();}
export function validMapPosition(point: MapPosition | undefined | null): point is MapPosition {
  return !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}
export function providerMapPoint(provider: CatalogProvider, cities: Record<string, MapPosition>): ProviderMapPoint | null {
  const position = provider.demo ? provider.demoPosition : cities[mapCityKey(provider.baseCity??'',provider.baseCountryCode)];
  if (!validMapPosition(position)) return null;
  const radius = provider.travelRadiusKm;
  return { ...position, id: provider.id,
    radiusKm: typeof radius === 'number' && Number.isFinite(radius) && radius > 0 && radius <= 500 ? radius : null,
    zones: provider.demo ? [] : provider.coverageCities.map(city => cities[mapCityKey(city,provider.baseCountryCode)]).filter(validMapPosition) };
}
/** JSON embedded in a script must not allow HTML to close that script. */
export function mapScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
export function selectedMapIds(raw: string, allowed: ProviderMapPoint[]): number[] {
  try {
    const value = JSON.parse(raw);
    return value.type === 'select' && Array.isArray(value.ids)
      ? [...new Set<number>(value.ids.filter((id: unknown) => typeof id === 'number' && allowed.some(p => p.id === id)))] : [];
  } catch { return []; }
}
