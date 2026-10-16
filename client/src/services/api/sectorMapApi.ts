import apiClient from '../apiClient';
import type { SectorGeometry } from '../../components/map/sectorLayer';

// ─── Carte des secteurs d'intervention des prestataires ─────────────────────
// Contours réunis côté serveur (secteurs voisins sous une seule bordure). « Couvert »
// suit la règle d'affectation, pas une inclusion géométrique.

export interface SectorZone {
  /** Clé du contour (« FR-A-75111 ») ; null si la zone n'a pas de contour connu. */
  key: string | null;
  name: string;
  kind: 'department' | 'arrondissement' | 'city' | 'unknown';
  /** Contour approché (cercle) faute de limite administrative connue. */
  approx: boolean;
  drawn: boolean;
}

export interface ProviderSectors {
  providerId: number | null;
  name: string | null;
  /** Photo du prestataire (URL signée ou absolue) ; null : initiales. */
  avatarUrl: string | null;
  geometry: SectorGeometry | null;
  zones: SectorZone[];
  /** Compte PMS du prestataire : celui des interventions qui lui sont assignées ; null sans compte. */
  userId: number | null;
}

export interface SectorProperty {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  /** Prestataires dont le secteur inclut ce logement. */
  coveredBy: number[];
}

export interface SectorMap {
  providers: ProviderSectors[];
  merged: SectorGeometry | null;
  properties: SectorProperty[];
  attribution: string;
}

export const sectorMapApi = {
  /** Prestataires visibles qui couvrent au moins un logement de l'organisation. */
  relevant(): Promise<SectorMap> {
    return apiClient.get<SectorMap>('/provider-catalog/sectors');
  },

  /** Secteur d'un prestataire et logements couverts ou non. */
  provider(providerId: number | string): Promise<SectorMap> {
    return apiClient.get<SectorMap>(`/provider-catalog/${providerId}/sectors`);
  },

  /** Secteur du prestataire relié au compte `userId` (intervenant d'une prestation) ; 404 sinon. */
  providerOfUser(userId: number): Promise<SectorMap> {
    return apiClient.get<SectorMap>(`/provider-catalog/sectors/by-user/${userId}`);
  },

  /** Secteur déclaré par l'intervenant connecté. */
  mine(): Promise<SectorMap> {
    return apiClient.get<SectorMap>('/my-coverage-zones/sectors');
  },
};
