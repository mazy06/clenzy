import apiClient from '../apiClient';

/**
 * KPI opérationnels par propriété pour les cartes de la liste (mois courant).
 * Calculés côté backend (org-scope) depuis les réservations + interventions —
 * endpoint batché `GET /api/properties/kpi-summaries?ids=1,2,3` (1 requête pour
 * toutes les cartes visibles, pas de N+1).
 */
export interface PropertyKpiSummary {
  propertyId: number;
  /** Taux d'occupation du mois courant, 0..1. */
  occupancyRate: number;
  /** Tarif journalier moyen du mois (revenu / nuits réservées). */
  adr: number;
  /** Revenu alloué au mois courant (au prorata des nuits). */
  revenue: number;
  /** "occupied" si une réservation couvre aujourd'hui, sinon "available". */
  operationalStatus: 'occupied' | 'available';
  /** Date ISO yyyy-MM-dd du check-out de la réservation en cours, ou null. */
  currentCheckOut: string | null;
  /** Heure de check-out (ex "11:00"), ou null. */
  currentCheckOutTime: string | null;
  /** "cleaning" | "maintenance" si une intervention est en cours, sinon null. */
  activeInterventionType: 'cleaning' | 'maintenance' | null;
}

export const propertyKpiApi = {
  getKpiSummaries: (ids: number[]): Promise<PropertyKpiSummary[]> => {
    if (ids.length === 0) return Promise.resolve([]);
    return apiClient.get<PropertyKpiSummary[]>('/properties/kpi-summaries', {
      params: { ids: ids.join(',') },
    });
  },
};
