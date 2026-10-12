import { apiClient } from '../apiClient';

// Même contrat que client/src/services/api/sectorMapApi.ts : les contours arrivent déjà
// réunis (secteurs voisins sous une seule bordure) et la page carte les dessine telle quelle.

type Position = number[];
export type SectorGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

export interface SectorZone {
  key: string | null;
  name: string;
  kind: 'department' | 'arrondissement' | 'city' | 'unknown';
  approx: boolean;
  drawn: boolean;
}

export interface ProviderSectors {
  providerId: number | null;
  name: string | null;
  geometry: SectorGeometry | null;
  zones: SectorZone[];
}

export interface SectorProperty {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  coveredBy: number[];
}

export interface SectorMap {
  providers: ProviderSectors[];
  merged: SectorGeometry | null;
  properties: SectorProperty[];
  attribution: string;
}

export const sectorMapApi = {
  /** Prestataires qui couvrent au moins un logement de l'organisation (hôtes, conciergeries). */
  relevant: () => apiClient.get<SectorMap>('/provider-catalog/sectors'),
  /** Secteur déclaré par l'intervenant connecté. */
  mine: () => apiClient.get<SectorMap>('/my-coverage-zones/sectors'),
};
