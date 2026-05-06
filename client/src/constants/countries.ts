/**
 * Liste des pays supportes pour l'adressage et le geocodage.
 * Le code ISO 3166-1 alpha-2 est utilise pour router vers le bon service de geocodage
 * (BAN pour la France, Nominatim pour les autres).
 */

export interface Country {
  /** Code ISO 3166-1 alpha-2 (FR, MA, DZ, SA, ...) */
  code: string;
  /** Nom complet en francais (affichage UI) */
  name: string;
  /** Drapeau emoji */
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algerie', flag: '🇩🇿' },
  { code: 'SA', name: 'Arabie Saoudite', flag: '🇸🇦' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // France

/** Map d'acces rapide par code ISO. */
export const COUNTRY_BY_CODE: Record<string, Country> = COUNTRIES.reduce(
  (acc, c) => ({ ...acc, [c.code]: c }),
  {}
);

/**
 * Retourne le pays correspondant a un nom (recherche insensible a la casse / accents).
 * Utile pour deduire le code ISO depuis l'ancien champ texte libre.
 */
export function findCountryByName(name: string | null | undefined): Country | null {
  if (!name) return null;
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  return COUNTRIES.find((c) => c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === normalized) ?? null;
}
