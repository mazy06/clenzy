/**
 * Geocoder unifie. Route vers le service approprie selon le pays :
 * - FR → BAN (api-adresse.data.gouv.fr) : meilleure precision pour la France
 * - autres (MA, DZ, SA, ...) → Nominatim (worldwide)
 */

import { banApi, type BanAddress } from './banApi';
import { nominatimApi } from './nominatimApi';

// ─── Type unifie ──────────────────────────────────────────────────────────────

export interface GeocodedAddress {
  label: string;
  street: string;
  housenumber: string;
  postcode: string;
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2 majuscule
  // FR-specific (vide pour les autres pays)
  citycode: string;
  department: string;
  arrondissement: string;
  latitude: number;
  longitude: number;
}

function fromBanAddress(b: BanAddress): GeocodedAddress {
  return {
    label: b.label,
    street: b.street,
    housenumber: b.housenumber,
    postcode: b.postcode,
    city: b.city,
    country: 'France',
    countryCode: 'FR',
    citycode: b.citycode,
    department: b.department,
    arrondissement: b.arrondissement,
    latitude: b.latitude,
    longitude: b.longitude,
  };
}

function fromNominatimAddress(n: {
  label: string;
  street: string;
  housenumber: string;
  postcode: string;
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}): GeocodedAddress {
  return {
    label: n.label,
    street: n.street,
    housenumber: n.housenumber,
    postcode: n.postcode,
    city: n.city,
    country: n.country,
    countryCode: n.countryCode,
    citycode: '',
    department: '',
    arrondissement: '',
    latitude: n.latitude,
    longitude: n.longitude,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const geocoderApi = {
  /**
   * Recherche d'adresses, route automatiquement selon le code pays.
   * @param query Texte de recherche
   * @param countryCode Code ISO 3166-1 alpha-2 (FR, MA, DZ, SA, ...)
   * @param limit Nombre max de resultats
   */
  search: async (
    query: string,
    countryCode: string = 'FR',
    limit = 5
  ): Promise<GeocodedAddress[]> => {
    const code = countryCode.toUpperCase();

    if (code === 'FR') {
      const banResults = await banApi.search(query, limit);
      return banResults.map(fromBanAddress);
    }

    const nominatimResults = await nominatimApi.search(query, [code.toLowerCase()], limit);
    return nominatimResults.map(fromNominatimAddress);
  },

  /**
   * Recherche de villes uniquement, route selon le pays.
   * @param query Texte de recherche
   * @param countryCode Code ISO 3166-1 alpha-2
   * @param limit Nombre max de resultats
   */
  searchCities: async (
    query: string,
    countryCode: string = 'FR',
    limit = 5
  ): Promise<GeocodedAddress[]> => {
    const code = countryCode.toUpperCase();

    if (code === 'FR') {
      const banResults = await banApi.searchMunicipalities(query, limit);
      return banResults.map(fromBanAddress);
    }

    const nominatimResults = await nominatimApi.searchCities(query, [code.toLowerCase()], limit);
    return nominatimResults.map(fromNominatimAddress);
  },
};
