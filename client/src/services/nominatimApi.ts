/**
 * Client pour l'API Nominatim (OpenStreetMap).
 * Geocodage worldwide, gratuit, sans cle d'API.
 * https://nominatim.org/release-docs/latest/api/Search/
 *
 * Limites :
 * - 1 req/sec maximum (Usage Policy OSM) → debounce 600ms recommande cote UI
 * - User-Agent obligatoire identifiant l'application
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Clenzy-PMS/1.0 (contact@clenzy.fr)';

// ─── Types Nominatim API ──────────────────────────────────────────────────────

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  importance: number;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    region?: string;
    postcode?: string;
    country?: string;
    country_code?: string; // 'fr', 'ma', 'dz', 'sa', ...
  };
}

// ─── Type unifie ──────────────────────────────────────────────────────────────

export interface NominatimAddress {
  label: string;
  street: string;
  housenumber: string;
  postcode: string;
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2 majuscule (FR, MA, ...)
  latitude: number;
  longitude: number;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function pickCity(addr: NominatimResult['address']): string {
  if (!addr) return '';
  return addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.neighbourhood || '';
}

function parseNominatimResult(r: NominatimResult): NominatimAddress {
  const addr = r.address || {};
  const street = addr.road || addr.pedestrian || '';
  return {
    label: r.display_name,
    street,
    housenumber: addr.house_number || '',
    postcode: addr.postcode || '',
    city: pickCity(addr),
    country: addr.country || '',
    countryCode: (addr.country_code || '').toUpperCase(),
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const nominatimApi = {
  /**
   * Recherche d'adresses via Nominatim.
   * @param query Texte de recherche (min 3 caracteres recommande)
   * @param countryCodes Codes ISO pour restreindre la recherche (ex: ['fr', 'ma'])
   * @param limit Nombre de resultats max (defaut: 5)
   */
  search: async (
    query: string,
    countryCodes: string[] = [],
    limit = 5
  ): Promise<NominatimAddress[]> => {
    if (!query || query.trim().length < 3) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        format: 'json',
        addressdetails: '1',
        limit: String(limit),
      });

      if (countryCodes.length > 0) {
        params.set('countrycodes', countryCodes.join(',').toLowerCase());
      }

      const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'fr,en;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
      }

      const data: NominatimResult[] = await response.json();
      return data.map(parseNominatimResult);
    } catch {
      return [];
    }
  },

  /**
   * Recherche de villes uniquement.
   * Utilise featuretype=city pour cibler les communes.
   * Note : Nominatim retourne aussi des town/village qu'on garde car pertinents.
   */
  searchCities: async (
    query: string,
    countryCodes: string[] = [],
    limit = 5
  ): Promise<NominatimAddress[]> => {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        format: 'json',
        addressdetails: '1',
        featuretype: 'city',
        limit: String(limit),
      });

      if (countryCodes.length > 0) {
        params.set('countrycodes', countryCodes.join(',').toLowerCase());
      }

      const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'fr,en;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
      }

      const data: NominatimResult[] = await response.json();
      // Filtrer strictement les communes (cities/towns/villages/municipalities).
      // On exclut administrative/country/state/region car ils peuvent matcher des pays ou regions.
      const VALID_CITY_TYPES = new Set(['city', 'town', 'village', 'municipality', 'hamlet', 'suburb']);
      return data
        .filter((r) => VALID_CITY_TYPES.has(r.type))
        .map(parseNominatimResult);
    } catch {
      return [];
    }
  },

  /**
   * Reverse geocoding : transforme des coordonnees GPS en adresse.
   */
  reverse: async (latitude: number, longitude: number): Promise<NominatimAddress | null> => {
    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: 'json',
        addressdetails: '1',
      });

      const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'fr,en;q=0.8',
        },
      });

      if (!response.ok) return null;

      const data: NominatimResult = await response.json();
      return parseNominatimResult(data);
    } catch {
      return null;
    }
  },
};
