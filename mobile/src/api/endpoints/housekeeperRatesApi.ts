import { apiClient } from '../apiClient';

// ─── Tarifs prestataire ménage (Moteur Ménage 2A/4B) ────────────────────────
// Miroir mobile de client/src/services/api/housekeeperRatesApi.ts :
// taux horaire général + forfaits par logement (priment), fourchette CONSEIL
// par logement pour le nudge « dans le marché » — jamais bloquant.

export interface HousekeeperPropertyRate {
  propertyId: number;
  propertyName: string;
  /** Forfait du pro pour ce logement — null si non défini. */
  flatAmount: number | null;
  advisoryMin: number;
  advisoryRecommended: number;
  advisoryMax: number;
}

/** Score qualité 30 jours : proofRate × min(1, missions/5) × 100. */
export interface HousekeeperScore {
  score: number;
  completedCount: number;
  proofRate: number;
}

export interface HousekeeperRates {
  /** Taux horaire de référence de l'org (contexte). */
  referenceHourlyRate: number;
  /** Taux horaire général du pro — null si non défini. */
  hourlyAmount: number | null;
  properties: HousekeeperPropertyRate[];
  score?: HousekeeperScore | null;
}

export interface UpdateHousekeeperRates {
  /** null = supprimer le taux horaire général. */
  hourlyAmount: number | null;
  /** État complet des forfaits (absents = supprimés). */
  flatRates: { propertyId: number; amount: number }[];
}

export const housekeeperRatesApi = {
  /** Mes tarifs (pro authentifié). */
  getMy() {
    return apiClient.get<HousekeeperRates>('/housekeeper-rates/me');
  },

  /** Upsert de MES tarifs (état complet). */
  updateMy(data: UpdateHousekeeperRates) {
    return apiClient.put<HousekeeperRates>('/housekeeper-rates/me', data);
  },
};
