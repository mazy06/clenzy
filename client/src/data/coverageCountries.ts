/**
 * Pays supportes pour les zones de couverture des equipes (Team Coverage Zones).
 *
 * - FR : matching par department + arrondissement (donnees statiques dans frenchDepartments.ts)
 * - MA / SA : matching par city (libelle saisi)
 *
 * Ajouter un pays : etendre `COVERAGE_COUNTRIES` + `getCitiesForCountry()`,
 * et ajuster `tryGeographicSearch` cote backend si necessaire.
 */

export interface CoverageCountry {
  /** Code ISO 3166-1 alpha-2. Stocke en DB. */
  code: string;
  /** Libelle affiche dans le selecteur. */
  name: string;
  /**
   * Mode de matching :
   * - 'department' : selecteur de departements + arrondissements (FR)
   * - 'city'       : selecteur de villes (autres pays)
   */
  matchMode: 'department' | 'city';
}

export const COVERAGE_COUNTRIES: CoverageCountry[] = [
  { code: 'FR', name: 'France', matchMode: 'department' },
  { code: 'MA', name: 'Maroc', matchMode: 'city' },
  { code: 'SA', name: 'Arabie Saoudite', matchMode: 'city' },
];

/** Villes principales du Maroc (pour le selecteur de zones de couverture). */
export const MOROCCAN_CITIES: string[] = [
  'Agadir',
  'Casablanca',
  'Dakhla',
  'El Jadida',
  'Errachidia',
  'Essaouira',
  'Fes',
  'Kenitra',
  'Khouribga',
  'Laayoune',
  'Marrakech',
  'Meknes',
  'Mohammedia',
  'Nador',
  'Ouarzazate',
  'Oujda',
  'Rabat',
  'Safi',
  'Sale',
  'Tanger',
  'Taroudant',
  'Tetouan',
];

/** Villes principales d'Arabie Saoudite. */
export const SAUDI_CITIES: string[] = [
  'Abha',
  'Al Khobar',
  'Buraidah',
  'Dammam',
  'Hail',
  'Hofuf',
  'Jeddah',
  'Jizan',
  'Khamis Mushait',
  'La Mecque',
  'Medine',
  'Najran',
  'Riyad',
  'Tabuk',
  'Taif',
  'Yanbu',
];

export function getCountryByCode(code: string): CoverageCountry | undefined {
  return COVERAGE_COUNTRIES.find((c) => c.code === code);
}

export function getCitiesForCountry(code: string): string[] {
  switch (code) {
    case 'MA':
      return MOROCCAN_CITIES;
    case 'SA':
      return SAUDI_CITIES;
    default:
      return [];
  }
}
