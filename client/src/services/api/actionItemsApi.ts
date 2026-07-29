import apiClient from '../apiClient';

/** Équipe candidate pour une assignation, telle que le serveur la classe. */
export interface AssignableTeam {
  teamId: number;
  name: string;
  /** `DEFAULT` (équipe du logement), `ZONE` (couvre la zone), `OTHER`. */
  origin: string;
  available: boolean;
  /** Interventions déjà posées sur le créneau. */
  conflicts: number;
}

/**
 * Les équipes proposables, et le type qu'il aurait fallu quand il n'y en a
 * aucune.
 *
 * <p>Une liste vide seule laisse devant un mur : on ne sait pas si l'on manque
 * d'équipe, de couverture de zone ou de disponibilité.</p>
 */
/** Un séjour dont le revenu compose le reversement. */
export interface CoveredStay {
  reservationId: number;
  guestName: string | null;
  propertyName: string | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number | null;
}

/** Une dépense déduite du reversement. */
export interface IncludedExpense {
  expenseId: number;
  description: string | null;
  category: string | null;
  expenseDate: string | null;
  amount: number | null;
}

/**
 * Ce qu'il faut savoir avant d'approuver un reversement.
 *
 * <p>Le compte de destination arrive **masqué** : un IBAN est chiffré en base,
 * et l'afficher en entier sur un tableau de bord n'apporte rien qu'un risque.</p>
 */
export interface PayoutRecap {
  payoutId: number;
  beneficiaryName: string | null;
  beneficiaryEmail: string | null;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number | null;
  /** Taux en pourcentage lisible (20.00, pas 0.20). */
  commissionRate: number | null;
  commissionAmount: number | null;
  expenses: number | null;
  netAmount: number | null;
  currency: string | null;
  payoutMethod: string | null;
  destination: string | null;
  /** Faux si aucun virement ne peut partir — compte absent ou non vérifié. */
  destinationReady: boolean;
  stays: CoveredStay[];
  deductions: IncludedExpense[];
}

/** Les photos de fin de mission d'une intervention. */
export interface InterventionProof {
  /** Tableau JSON de données en base64, format de l'écran des interventions. */
  photos: string | null;
  /** Faux si aucune photo de fin : le paiement du prestataire restera bloqué. */
  proofComplete: boolean;
}

export interface AssignableTeams {
  teams: AssignableTeam[];
  /** `CLEANING`, `MAINTENANCE`, `OTHER` — `null` si le type n'est pas reconnu. */
  requiredTeamType: string | null;
}

/**
 * Clôture d'une action de la file « à traiter ».
 *
 * <p>La liste arrive avec le tableau de bord : seule la clôture a besoin d'un
 * appel dédié. Elle sert aux actions nées d'un événement (litige, virement
 * refusé), que rien ne peut refermer automatiquement — une action déduite des
 * données, elle, disparaît d'elle-même quand sa cause disparaît.</p>
 */
export const actionItemsApi = {
  /** Retire l'action de la file, le nécessaire ayant été fait ailleurs. */
  resolve: (id: number): Promise<void> =>
    apiClient.post<void>(`/action-items/${id}/resolve`),

  /**
   * Demande un recalcul immédiat de la file.
   *
   * <p>La file est reconstruite périodiquement côté serveur. Cela convient à
   * une anomalie qui apparaît, mais pas à une ligne qu'on vient de traiter :
   * la voir persister donnerait l'impression que le geste n'a pas pris.</p>
   */
  refresh: (): Promise<void> => apiClient.post<void>('/action-items/refresh'),

  /**
   * Réessaie l'envoi que l'action signale — document non délivré, message
   * voyageur en échec. Le canal d'origine est conservé.
   */
  retry: (id: number): Promise<void> => apiClient.post<void>(`/action-items/${id}/retry`),

  /**
   * Exécute le geste nommé sur cette action — acquitter, approuver, confirmer,
   * publier, rejouer.
   *
   * <p>Un seul point d'entrée plutôt qu'un par geste : c'est le serveur qui
   * sait quel service porte réellement l'action, et c'est là que
   * l'appartenance à l'organisation se vérifie, une fois.</p>
   */
  act: (
    id: number,
    action: string,
    assigneeTeamId?: number | null,
    /** Nouvelle date, pour les gestes de replanification (`yyyy-MM-ddTHH:mm`). */
    scheduledAt?: string | null,
  ): Promise<void> =>
    apiClient.post<void>(`/action-items/${id}/act`, { action, assigneeTeamId, scheduledAt }),

  /**
   * Équipes proposées pour assigner l'intervention que cette action signale.
   *
   * <p>Celles qui couvrent la zone sont proposées même occupées : une liste
   * vide ferait croire qu'il n'existe personne, ce qui est faux et bloque.</p>
   */
  /**
   * Ce qu'il faut savoir avant d'approuver un reversement : bénéficiaire,
   * période, détail du calcul, moyen de versement et séjours couverts.
   */
  payoutRecap: (id: number): Promise<PayoutRecap> =>
    apiClient.get<PayoutRecap>(`/action-items/${id}/payout-recap`),

  /** Photos de fin de mission — la preuve dont dépend le paiement du prestataire. */
  interventionProof: (id: number): Promise<InterventionProof> =>
    apiClient.get<InterventionProof>(`/action-items/${id}/intervention-proof`),

  assignableTeams: (id: number): Promise<AssignableTeams> =>
    apiClient.get<AssignableTeams>(`/action-items/${id}/assignable-teams`),
};

/**
 * Rafraîchit la file puis les vues qui en dépendent.
 *
 * <p>À appeler après un geste qui rend une ligne caduque sans la clôturer
 * explicitement — encaisser un solde, relancer un flux, répondre à un avis.
 * Le recalcul est best-effort : s'il échoue, on invalide quand même, et la
 * ligne disparaîtra au balayage suivant plutôt que de bloquer l'écran sur une
 * erreur qui ne concerne pas l'utilisateur.</p>
 */
export async function refreshActionQueue(
  invalidate: (key: readonly unknown[]) => Promise<unknown>,
  keys: readonly (readonly unknown[])[],
): Promise<void> {
  try {
    await actionItemsApi.refresh();
  } catch {
    // Sans conséquence visible : la file se remettra à jour d'elle-même.
  }
  await Promise.all(keys.map((key) => invalidate([...key])));
}
