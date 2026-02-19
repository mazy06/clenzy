/**
 * Donnees statiques des departements francais.
 * Inclut metropole, Corse (2A, 2B) et DOM-TOM.
 */

export interface Department {
  code: string;
  name: string;
}

export const FRENCH_DEPARTMENTS: Department[] = [
  { code: '01', name: 'Ain' },
  { code: '02', name: 'Aisne' },
  { code: '03', name: 'Allier' },
  { code: '04', name: 'Alpes-de-Haute-Provence' },
  { code: '05', name: 'Hautes-Alpes' },
  { code: '06', name: 'Alpes-Maritimes' },
  { code: '07', name: 'Ardeche' },
  { code: '08', name: 'Ardennes' },
  { code: '09', name: 'Ariege' },
  { code: '10', name: 'Aube' },
  { code: '11', name: 'Aude' },
  { code: '12', name: 'Aveyron' },
  { code: '13', name: 'Bouches-du-Rhone' },
  { code: '14', name: 'Calvados' },
  { code: '15', name: 'Cantal' },
  { code: '16', name: 'Charente' },
  { code: '17', name: 'Charente-Maritime' },
  { code: '18', name: 'Cher' },
  { code: '19', name: 'Correze' },
  { code: '2A', name: 'Corse-du-Sud' },
  { code: '2B', name: 'Haute-Corse' },
  { code: '21', name: 'Cote-d\'Or' },
  { code: '22', name: 'Cotes-d\'Armor' },
  { code: '23', name: 'Creuse' },
  { code: '24', name: 'Dordogne' },
  { code: '25', name: 'Doubs' },
  { code: '26', name: 'Drome' },
  { code: '27', name: 'Eure' },
  { code: '28', name: 'Eure-et-Loir' },
  { code: '29', name: 'Finistere' },
  { code: '30', name: 'Gard' },
  { code: '31', name: 'Haute-Garonne' },
  { code: '32', name: 'Gers' },
  { code: '33', name: 'Gironde' },
  { code: '34', name: 'Herault' },
  { code: '35', name: 'Ille-et-Vilaine' },
  { code: '36', name: 'Indre' },
  { code: '37', name: 'Indre-et-Loire' },
  { code: '38', name: 'Isere' },
  { code: '39', name: 'Jura' },
  { code: '40', name: 'Landes' },
  { code: '41', name: 'Loir-et-Cher' },
  { code: '42', name: 'Loire' },
  { code: '43', name: 'Haute-Loire' },
  { code: '44', name: 'Loire-Atlantique' },
  { code: '45', name: 'Loiret' },
  { code: '46', name: 'Lot' },
  { code: '47', name: 'Lot-et-Garonne' },
  { code: '48', name: 'Lozere' },
  { code: '49', name: 'Maine-et-Loire' },
  { code: '50', name: 'Manche' },
  { code: '51', name: 'Marne' },
  { code: '52', name: 'Haute-Marne' },
  { code: '53', name: 'Mayenne' },
  { code: '54', name: 'Meurthe-et-Moselle' },
  { code: '55', name: 'Meuse' },
  { code: '56', name: 'Morbihan' },
  { code: '57', name: 'Moselle' },
  { code: '58', name: 'Nievre' },
  { code: '59', name: 'Nord' },
  { code: '60', name: 'Oise' },
  { code: '61', name: 'Orne' },
  { code: '62', name: 'Pas-de-Calais' },
  { code: '63', name: 'Puy-de-Dome' },
  { code: '64', name: 'Pyrenees-Atlantiques' },
  { code: '65', name: 'Hautes-Pyrenees' },
  { code: '66', name: 'Pyrenees-Orientales' },
  { code: '67', name: 'Bas-Rhin' },
  { code: '68', name: 'Haut-Rhin' },
  { code: '69', name: 'Rhone' },
  { code: '70', name: 'Haute-Saone' },
  { code: '71', name: 'Saone-et-Loire' },
  { code: '72', name: 'Sarthe' },
  { code: '73', name: 'Savoie' },
  { code: '74', name: 'Haute-Savoie' },
  { code: '75', name: 'Paris' },
  { code: '76', name: 'Seine-Maritime' },
  { code: '77', name: 'Seine-et-Marne' },
  { code: '78', name: 'Yvelines' },
  { code: '79', name: 'Deux-Sevres' },
  { code: '80', name: 'Somme' },
  { code: '81', name: 'Tarn' },
  { code: '82', name: 'Tarn-et-Garonne' },
  { code: '83', name: 'Var' },
  { code: '84', name: 'Vaucluse' },
  { code: '85', name: 'Vendee' },
  { code: '86', name: 'Vienne' },
  { code: '87', name: 'Haute-Vienne' },
  { code: '88', name: 'Vosges' },
  { code: '89', name: 'Yonne' },
  { code: '90', name: 'Territoire de Belfort' },
  { code: '91', name: 'Essonne' },
  { code: '92', name: 'Hauts-de-Seine' },
  { code: '93', name: 'Seine-Saint-Denis' },
  { code: '94', name: 'Val-de-Marne' },
  { code: '95', name: 'Val-d\'Oise' },
  { code: '971', name: 'Guadeloupe' },
  { code: '972', name: 'Martinique' },
  { code: '973', name: 'Guyane' },
  { code: '974', name: 'La Reunion' },
  { code: '976', name: 'Mayotte' },
];

// ─── Arrondissements pour Paris, Lyon, Marseille ──────────────────────────────

export interface Arrondissement {
  code: string;
  name: string;
}

export const PARIS_ARRONDISSEMENTS: Arrondissement[] = Array.from({ length: 20 }, (_, i) => ({
  code: `751${String(i + 1).padStart(2, '0')}`,
  name: `${i + 1}${i === 0 ? 'er' : 'e'} arrondissement`,
}));

export const LYON_ARRONDISSEMENTS: Arrondissement[] = Array.from({ length: 9 }, (_, i) => ({
  code: `6938${i + 1}`,
  name: `${i + 1}${i === 0 ? 'er' : 'e'} arrondissement`,
}));

export const MARSEILLE_ARRONDISSEMENTS: Arrondissement[] = Array.from({ length: 16 }, (_, i) => ({
  code: `132${String(i + 1).padStart(2, '0')}`,
  name: `${i + 1}${i === 0 ? 'er' : 'e'} arrondissement`,
}));

/**
 * Retourne la liste des arrondissements pour un departement donne.
 * Retourne un tableau vide si le departement n'a pas d'arrondissements.
 */
export function getArrondissementsForDepartment(departmentCode: string): Arrondissement[] {
  switch (departmentCode) {
    case '75': return PARIS_ARRONDISSEMENTS;
    case '69': return LYON_ARRONDISSEMENTS;
    case '13': return MARSEILLE_ARRONDISSEMENTS;
    default: return [];
  }
}

/**
 * Verifie si un departement a des arrondissements (Paris, Lyon, Marseille).
 */
export function hasArrondissements(departmentCode: string): boolean {
  return ['75', '69', '13'].includes(departmentCode);
}
