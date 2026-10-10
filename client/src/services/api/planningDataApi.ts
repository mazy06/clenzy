import { baitlyPlanningReadQueue } from '../baitlyPlanningReadQueue';
import apiClient from '../apiClient';
import type { Reservation, PlanningIntervention, PlanningServiceRequest } from '../api';
import type { CalendarBlockedDay } from './calendarPricingApi';
import type { PlanningProperty } from '../../modules/planning/types';

interface BaitlyPlanningPropertyPage {
  content: PlanningProperty[];
  number: number;
  totalPages: number;
}

/** Les quatre jeux de données que le planning peint sur une même fenêtre. */
export interface PlanningData {
  reservations: Reservation[];
  interventions: PlanningIntervention[];
  awaitingPayment: PlanningServiceRequest[];
  blocked: CalendarBlockedDay[];
}

export const planningDataApi = {
  /** Toutes les pages du catalogue léger, sans troncature à 1 000 logements. */
  async getProperties(signal?: AbortSignal): Promise<PlanningProperty[]> {
    const properties = new Map<number, PlanningProperty>();
    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
      const response = await baitlyPlanningReadQueue.run(signal, () => apiClient.get<BaitlyPlanningPropertyPage>('/planning/properties', {
        signal, params: { page, size: 200 },
      }));
      for (const property of response.content) properties.set(property.id, property);
      totalPages = response.totalPages;
      page++;
    }
    return [...properties.values()];
  },

  async getIndex(propertyIds: number[], from: string, to: string, signal?: AbortSignal): Promise<PlanningData> {
    const result: PlanningData = { reservations: [], interventions: [], awaitingPayment: [], blocked: [] };
    const ids = [...new Set(propertyIds)];
    // Borner aussi l'URL et le IN SQL des grands portefeuilles.
    for (let offset = 0; offset < ids.length; offset += 500) {
      const data = await baitlyPlanningReadQueue.run(signal, () => apiClient.get<PlanningData>('/planning/index', {
        signal, params: { propertyIds: ids.slice(offset, offset + 500).join(','), from, to },
      }));
      // L'index omet volontairement le nom du logement répété pour chaque séjour.
      result.reservations.push(...data.reservations.map((r) => ({ ...r, propertyName: '' })));
      result.interventions.push(...data.interventions);
      result.awaitingPayment.push(...data.awaitingPayment);
      result.blocked.push(...data.blocked);
    }
    return result;
  },

  async getReservationDetails(propertyIds: number[], from: string, to: string, signal?: AbortSignal): Promise<PlanningData> {
    const reservations = await baitlyPlanningReadQueue.run(signal, () => apiClient.get<Reservation[]>('/planning/reservations', {
      signal, params: { propertyIds: propertyIds.join(','), from, to },
    }));
    return { reservations, interventions: [], awaitingPayment: [], blocked: [] };
  },
  /**
   * Séjours, interventions, demandes en attente de paiement et jours bloqués,
   * en UN appel.
   *
   * <p>Ces quatre jeux vivaient derrière quatre endpoints appelés avec les mêmes
   * logements et la même plage : quatre requêtes par tranche de dates, soit
   * douze pour peindre une fenêtre. Chacune repayait l'authentification, le
   * filtre de tenant et les intercepteurs — et consommait le quota de l'API.</p>
   *
   * <p>La section `interventions` revient vide si le porteur n'a pas le rôle
   * requis (ADMIN / MANAGER / SUPER_ADMIN) : c'est exactement ce qu'il voyait
   * avant, sans le 403 qui faisait remonter une erreur sur toute la grille.</p>
   */
  async getPlanningData(
    propertyIds: number[],
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<PlanningData> {
    return apiClient.get<PlanningData>('/planning/data', {
      signal,
      params: { propertyIds: propertyIds.join(','), from, to },
    });
  },
};
