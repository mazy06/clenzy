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

/**
 * Nature d'une action en attente. L'ordre reflète la priorité d'affichage :
 * un solde non encaissé passe avant un avis sans réponse à sévérité égale.
 */
export type DashboardActionKind =
  | 'BALANCE_DUE'
  | 'SERVICE_UNPAID'
  | 'SERVICE_UNASSIGNED'
  | 'FEED_STALE'
  | 'REVIEW_UNANSWERED';

export type DashboardActionSeverity = 'critical' | 'warning' | 'info';

/**
 * Une ligne de la file « à traiter », quelle que soit son origine.
 *
 * Le serveur a déjà trié et plafonné : le front rend la liste dans l'ordre reçu,
 * sans re-arbitrer.
 */
export interface DashboardActionItem {
  /** Identité stable, préfixée par la nature — `hitl:42`, `review:7`. */
  id: string;
  kind: DashboardActionKind;
  severity: DashboardActionSeverity;
  title: string;
  detail: string | null;
  /** Personne concernée, s'il y en a une — porte l'avatar de la ligne. */
  subject: string | null;
  /** Identifiant de l'objet visé, pour agir dessus. */
  targetId: number | null;
  propertyName: string | null;
  /**
   * Valeur numérique en jeu, interprétée selon la nature : un montant pour
   * `BALANCE_DUE` et `SERVICE_UNPAID`, un nombre d'heures pour `FEED_STALE`
   * (`null` = jamais synchronisé — c'est le serveur qui donne le nombre, le
   * front qui écrit la phrase, pour rester traduisible).
   */
  amount: number | null;
  /** Mention courte de fin de ligne (`4★`), quand ce n'est pas un montant. */
  badge: string | null;
}

export interface DashboardActionItems {
  /** Déjà trié et plafonné par nature côté serveur. */
  items: DashboardActionItem[];
  /** Nombre réel d'actions en attente, avant plafonnement — alimente le badge. */
  total: number;
  /**
   * Décompte réel par nature, avant plafonnement. Sans lui l'écran ne pourrait
   * compter que les lignes reçues, et écrirait « Avis (3) » là où douze attendent.
   */
  totalsByKind: Partial<Record<DashboardActionKind, number>>;
}

export const dashboardOperationsApi = {
  getToday: (): Promise<DashboardOperations> =>
    apiClient.get<DashboardOperations>('/dashboard/operations/today'),

  getUpcomingArrivals: (days = 7): Promise<DashboardUpcomingArrival[]> =>
    apiClient.get<DashboardUpcomingArrival[]>('/dashboard/upcoming-arrivals', { params: { days } }),

  getActionItems: (): Promise<DashboardActionItems> =>
    apiClient.get<DashboardActionItems>('/dashboard/action-items'),
};

/**
 * Total des éléments à traiter — alimente le badge « N à traiter » de l'en-tête.
 *
 * On compte le total réel du serveur, pas les lignes affichées : le badge dit ce
 * qui attend, la carte montre ce qui tient à l'écran.
 */
export function countActionItems(items: DashboardActionItems | undefined): number {
  return items?.total ?? 0;
}
