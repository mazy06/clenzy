/**
 * Client pour l'API Adresse (BAN - Base Adresse Nationale)
 * https://api-adresse.data.gouv.fr/
 * API gratuite, sans cle d'API
 */

const BAN_BASE_URL = 'https://api-adresse.data.gouv.fr';

// ─── Types BAN API ────────────────────────────────────────────────────────────

export interface BanFeature {
  type: 'Feature';
  properties: {
    label: string;
    score: number;
    housenumber?: string;
    id: string;
    name: string;
    postcode: string;
    citycode: string;
    city: string;
    context: string;
    type: string;
    street?: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface BanResponse {
  type: 'FeatureCollection';
  features: BanFeature[];
}

// ─── Type parsed pour l'application ───────────────────────────────────────────

export interface BanAddress {
  label: string;
  street: string;
  housenumber: string;
  postcode: string;
  city: string;
  citycode: string;
  department: string;
  arrondissement: string;
  latitude: number;
  longitude: number;
}

// ─── Fonctions utilitaires ────────────────────────────────────────────────────

/**
 * Extrait le code departement depuis le code postal ou le citycode.
 * Gere les cas speciaux : Corse (2A, 2B), DOM-TOM (971-976).
 */
export function extractDepartment(postcode: string, citycode: string): string {
  if (!postcode && !citycode) return '';

  const code = citycode || postcode;

  // Corse : citycode commence par 2A ou 2B
  if (code.startsWith('2A') || code.startsWith('2B')) {
    return code.substring(0, 2);
  }
  // Postcode Corse : 20xxx → utiliser citycode pour distinguer 2A/2B
  if (postcode?.startsWith('20') && citycode) {
    if (citycode.startsWith('2A')) return '2A';
    if (citycode.startsWith('2B')) return '2B';
  }

  // DOM-TOM : 3 chiffres (971, 972, 973, 974, 976)
  if (code.startsWith('97') && code.length >= 3) {
    return code.substring(0, 3);
  }

  // Metropole : 2 premiers chiffres
  return code.substring(0, 2);
}

/**
 * Extrait l'arrondissement pour Paris, Lyon et Marseille.
 * Pour les autres villes, retourne une chaine vide.
 *
 * - Paris : citycode "75101" a "75120" → arrondissement = citycode
 * - Lyon  : citycode "69381" a "69389" → arrondissement = citycode
 * - Marseille : citycode "13201" a "13216" → arrondissement = citycode
 */
export function extractArrondissement(citycode: string): string {
  if (!citycode) return '';

  // Paris : 75101-75120
  if (citycode.startsWith('751') && citycode.length === 5) {
    return citycode;
  }

  // Lyon : 69381-69389
  if (citycode.startsWith('6938') && citycode.length === 5) {
    return citycode;
  }

  // Marseille : 13201-13216
  if (citycode.startsWith('132') && citycode.length === 5) {
    const num = parseInt(citycode.substring(3), 10);
    if (num >= 1 && num <= 16) {
      return citycode;
    }
  }

  return '';
}

/**
 * Parse un BanFeature en BanAddress exploitable.
 */
function parseBanFeature(feature: BanFeature): BanAddress {
  const { properties, geometry } = feature;
  const department = extractDepartment(properties.postcode, properties.citycode);
  const arrondissement = extractArrondissement(properties.citycode);

  return {
    label: properties.label,
    street: properties.street || properties.name || '',
    housenumber: properties.housenumber || '',
    postcode: properties.postcode,
    city: properties.city,
    citycode: properties.citycode,
    department,
    arrondissement,
    latitude: geometry.coordinates[1],
    longitude: geometry.coordinates[0],
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const banApi = {
  /**
   * Recherche d'adresses via l'API BAN.
   * @param query Texte de recherche (minimum 3 caracteres recommande)
   * @param limit Nombre de resultats max (defaut: 5)
   */
  search: async (query: string, limit = 5): Promise<BanAddress[]> => {
    if (!query || query.trim().length < 3) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        limit: String(limit),
      });

      const response = await fetch(`${BAN_BASE_URL}/search/?${params.toString()}`);

      if (!response.ok) {
        console.error('BAN API error:', response.status, response.statusText);
        return [];
      }

      const data: BanResponse = await response.json();
      return data.features.map(parseBanFeature);
    } catch (error) {
      console.error('BAN API fetch error:', error);
      return [];
    }
  },
};
