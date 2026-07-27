import apiClient from '../apiClient';

/**
 * Blocs opérationnels du Dashboard : la journée en cours, les arrivées à venir,
 * et ce qui reste à traiter (`DashboardOperationsController`).
 *
 * Org-scopé côté serveur ; un hôte ne voit que ses logements, un intervenant
 * que ses interventions. Toutes les listes sont **bornées à 20 lignes** par le
 * serveur — au-delà, c'est le module dédié qui prend le relais.
 */

export interface DashboardArrival {
  reservationId: number;
  guestName: string | null;
  propertyId: number | null;
  propertyName: string | null;
  /** Heure de la réservation, à défaut celle du logement. `null` si aucune. */
  checkInTime: string | null;
  /** Canal normalisé : `airbnb` | `booking` | `direct` | `other`. */
  source: string | null;
  sourceName: string | null;
  /** Demande particulière du voyageur, déjà tronquée par le serveur. */
  note: string | null;
  guestCount: number;
}

export interface DashboardDeparture {
  reservationId: number;
  guestName: string | null;
  propertyId: number | null;
  propertyName: string | null;
  checkOutTime: string | null;
  /** `null` s'il n'y a aucune caution à libérer. */
  securityDepositId: number | null;
  depositToRelease: number | null;
}

export interface DashboardCleaning {
  interventionId: number;
  propertyId: number | null;
  propertyName: string | null;
  assigneeName: string | null;
  /** Bornes `HH:mm` de la fenêtre d'intervention ; `null` si non planifiées. */
  windowStart: string | null;
  windowEnd: string | null;
  status: string | null;
}

export interface DashboardOperations {
  arrivals: DashboardArrival[];
  departures: DashboardDeparture[];
  cleanings: DashboardCleaning[];
}

export interface DashboardUpcomingArrival {
  reservationId: number;
  guestName: string | null;
  propertyId: number | null;
  propertyName: string | null;
  /** ISO `yyyy-MM-dd`. */
  checkIn: string;
  nights: number;
  source: string | null;
  sourceName: string | null;
  paymentStatus: string | null;
  totalPrice: number | null;
  amountDue: number | null;
}

export interface DashboardBalanceDue {
  reservationId: number;
  reference: string;
  guestName: string | null;
  propertyName: string | null;
  checkIn: string;
  amountDue: number;
}

export interface DashboardUnansweredReview {
  reviewId: number;
  /** Voyageur qui a laissé l'avis — `null` sur les avis importés sans auteur. */
  guestName: string | null;
  propertyName: string | null;
  channelName: string | null;
  rating: number | null;
  excerpt: string | null;
  reviewDate: string | null;
}

export interface DashboardStaleFeed {
  feedId: number;
  propertyId: number | null;
  propertyName: string | null;
  sourceName: string | null;
  lastSyncStatus: string | null;
  /** `null` si le flux n'a jamais été synchronisé. */
  hoursSinceLastSync: number | null;
}

export interface DashboardActionItems {
  balancesDue: DashboardBalanceDue[];
  unansweredReviews: DashboardUnansweredReview[];
  staleFeeds: DashboardStaleFeed[];
}

export const dashboardOperationsApi = {
  getToday: (): Promise<DashboardOperations> =>
    apiClient.get<DashboardOperations>('/dashboard/operations/today'),

  getUpcomingArrivals: (days = 7): Promise<DashboardUpcomingArrival[]> =>
    apiClient.get<DashboardUpcomingArrival[]>('/dashboard/upcoming-arrivals', { params: { days } }),

  getActionItems: (): Promise<DashboardActionItems> =>
    apiClient.get<DashboardActionItems>('/dashboard/action-items'),
};

/** Total des éléments à traiter — alimente le badge « N à traiter » de l'en-tête. */
export function countActionItems(items: DashboardActionItems | undefined): number {
  if (!items) return 0;
  return items.balancesDue.length + items.unansweredReviews.length + items.staleFeeds.length;
}
