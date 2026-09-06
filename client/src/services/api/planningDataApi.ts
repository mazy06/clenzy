import apiClient from '../apiClient';
import type { Reservation, PlanningIntervention, PlanningServiceRequest } from '../api';
import type { CalendarBlockedDay } from './calendarPricingApi';

/** Les quatre jeux de données que le planning peint sur une même fenêtre. */
export interface PlanningData {
  reservations: Reservation[];
  interventions: PlanningIntervention[];
  awaitingPayment: PlanningServiceRequest[];
  blocked: CalendarBlockedDay[];
}

export const planningDataApi = {
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
  ): Promise<PlanningData> {
    return apiClient.get<PlanningData>('/planning/data', {
      params: { propertyIds: propertyIds.join(','), from, to },
    });
  },
};
