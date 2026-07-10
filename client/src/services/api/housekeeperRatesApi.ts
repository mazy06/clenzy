import apiClient from '../apiClient';

// ─── Tarifs prestataire ménage (Moteur Ménage 2A) ────────────────────────────
// Taux horaire général (property null) + forfaits par logement (priment).
// Chaque logement porte la fourchette CONSEIL (quote CLEANING) pour le nudge
// « dans le marché » — ancre médiane, jamais de blocage.

export interface HousekeeperPropertyRate {
  propertyId: number;
  propertyName: string;
  /** Forfait du pro pour ce logement — null si non défini. */
  flatAmount: number | null;
  advisoryMin: number;
  advisoryRecommended: number;
  advisoryMax: number;
}

export interface HousekeeperRates {
  /** Taux horaire de référence de l'org (contexte). */
  referenceHourlyRate: number;
  /** Taux horaire général du pro — null si non défini. */
  hourlyAmount: number | null;
  properties: HousekeeperPropertyRate[];
}

export interface UpdateHousekeeperRates {
  /** null = supprimer le taux horaire général. */
  hourlyAmount: number | null;
  /** État complet des forfaits (absents = supprimés). */
  flatRates: { propertyId: number; amount: number }[];
}

export const housekeeperRatesApi = {
  /** Mes tarifs (pro authentifié). */
  getMy(): Promise<HousekeeperRates> {
    return apiClient.get<HousekeeperRates>('/housekeeper-rates/me');
  },

  /** Upsert de MES tarifs (état complet). */
  updateMy(data: UpdateHousekeeperRates): Promise<HousekeeperRates> {
    return apiClient.put<HousekeeperRates>('/housekeeper-rates/me', data);
  },

  /** Tarifs d'un pro — staff plateforme. */
  getForUser(userId: number): Promise<HousekeeperRates> {
    return apiClient.get<HousekeeperRates>(`/housekeeper-rates/user/${userId}`);
  },

  /** Upsert des tarifs d'un pro — staff plateforme. */
  updateForUser(userId: number, data: UpdateHousekeeperRates): Promise<HousekeeperRates> {
    return apiClient.put<HousekeeperRates>(`/housekeeper-rates/user/${userId}`, data);
  },
};
