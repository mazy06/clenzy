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

/** Map d'acces rapide par code ISO. */
export const COUNTRY_BY_CODE: Record<string, Country> = COUNTRIES.reduce(
  (acc, c) => ({ ...acc, [c.code]: c }),
  {}
);
