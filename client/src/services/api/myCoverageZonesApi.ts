import apiClient from '../apiClient';

// ─── Zone d'intervention declaree par l'intervenant ─────────────────────────
// Les zones vivent cote serveur dans `team_coverage_zones` : un independant
// passe par son equipe PERSONNELLE, creee au premier enregistrement. C'est ce
// qui le rend visible du moteur d'affectation, qui ne raisonne qu'en equipes.

export interface CoverageZone {
  id: number;
  /** Code ISO 3166-1 alpha-2 : « FR », « MA »… */
  country: string;
  /** France : code departement (« 75 »). Null ailleurs. */
  department: string | null;
  /** France : arrondissement (« 75001 »). Null ailleurs. */
  arrondissement: string | null;
  /** Hors France : libelle de la ville. Null en France. */
  city: string | null;
}

export type CoverageZoneInput = Omit<CoverageZone, 'id'>;

export const myCoverageZonesApi = {
  getMine(): Promise<CoverageZone[]> {
    return apiClient.get<CoverageZone[]>('/my-coverage-zones');
  },

  /** REMPLACE la zone declaree — l'intervenant decrit ou il travaille aujourd'hui. */
  replace(zones: CoverageZoneInput[]): Promise<CoverageZone[]> {
    return apiClient.put<CoverageZone[]>('/my-coverage-zones', zones);
  },
};
