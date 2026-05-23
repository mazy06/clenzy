/**
 * Payouts API — reversements aux propriétaires.
 *
 * Critique pour les conciergeries qui gèrent les biens de plusieurs propriétaires :
 * permet de visualiser les reversements pending / approved / paid et d'agir
 * (approuver, exécuter via Wise / SEPA / Stripe Connect).
 *
 * Aligné sur le contrôleur backend `AccountingController` (`/api/accounting/payouts`).
 */
import { apiClient } from '../apiClient';

export type PayoutStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'EXECUTING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export type PayoutGenerationType = 'MANUAL' | 'AUTOMATIC' | 'SCHEDULED';

export type PayoutMethod =
  | 'MANUAL'
  | 'STRIPE_CONNECT'
  | 'SEPA_TRANSFER'
  | 'WISE'
  | 'OPEN_BANKING';

export interface OwnerPayoutDto {
  id: number;
  ownerId: number;
  ownerName: string | null;
  periodStart: string; // ISO date YYYY-MM-DD
  periodEnd: string;
  grossRevenue: number;
  commissionAmount: number;
  commissionRate: number;
  expenses: number;
  netAmount: number;
  status: PayoutStatus;
  generationType: PayoutGenerationType;
  payoutMethod: PayoutMethod | null;
  stripeTransferId: string | null;
  paymentReference: string | null;
  paidAt: string | null; // ISO instant
  failureReason: string | null;
  retryCount: number;
  notes: string | null;
  createdAt: string;
}

export interface PendingPayoutSummary {
  pendingCount: number;
  totalPendingAmount: number;
}

export interface GeneratePayoutRequest {
  ownerId: number;
  from: string; // YYYY-MM-DD
  to: string;
}

export interface GenerateBatchRequest {
  from: string; // YYYY-MM-DD
  to: string;
}

export interface MarkAsPaidRequest {
  paymentReference: string;
}

export interface SendStatementRequest {
  ownerId: number;
  from: string; // YYYY-MM-DD
  to: string;
}

export interface SendStatementResult {
  emailSentTo: string;
  ownerName: string;
  payoutsCount: number;
  totalPaid: number;
  totalGross: number;
  totalCommission: number;
  totalExpenses: number;
}

/**
 * Filters compatibles avec l'endpoint `GET /api/accounting/payouts`.
 * `ownerId` et `status` sont mutuellement exclusifs côté backend.
 */
export interface PayoutListParams {
  ownerId?: number;
  status?: PayoutStatus;
}

export const payoutsApi = {
  /** List payouts for the organization (admin/manager). Filterable by owner or status. */
  list(params?: PayoutListParams) {
    const query: Record<string, string> = {};
    if (params?.ownerId != null) query.ownerId = String(params.ownerId);
    if (params?.status) query.status = params.status;
    return apiClient.get<OwnerPayoutDto[]>('/accounting/payouts', { params: query });
  },

  /** Get a single payout detail. */
  get(id: number) {
    return apiClient.get<OwnerPayoutDto>(`/accounting/payouts/${id}`);
  },

  /** Pending count + total amount for the org dashboard widget. */
  pendingSummary() {
    return apiClient.get<PendingPayoutSummary>('/accounting/payouts/pending-count');
  },

  /**
   * Pending count + amount for the authenticated user as **owner** (prestataire).
   * Useful when the host of Clenzy is themselves the owner of properties.
   */
  myPendingSummary() {
    return apiClient.get<PendingPayoutSummary>('/accounting/payouts/my-pending');
  },

  /**
   * Génère manuellement un payout pour un propriétaire sur une période.
   * Réservé aux SUPER_ADMIN / SUPER_MANAGER côté backend (vérifier le rôle avant d'afficher l'action).
   */
  generate(request: GeneratePayoutRequest) {
    const query: Record<string, string> = {
      ownerId: String(request.ownerId),
      from: request.from,
      to: request.to,
    };
    return apiClient.post<OwnerPayoutDto>('/accounting/payouts/generate', undefined, { params: query });
  },

  /**
   * Generation batch : cree un payout PENDING pour tous les proprietaires
   * eligibles de l'organisation sur la periode. Idempotent : si un payout
   * existe deja pour un (owner, periode), il est retourne tel quel.
   *
   * Critique pour le workflow fin de mois des conciergeries.
   */
  generateBatch(request: GenerateBatchRequest) {
    const query: Record<string, string> = {
      from: request.from,
      to: request.to,
    };
    return apiClient.post<OwnerPayoutDto[]>('/accounting/payouts/generate-batch', undefined, { params: query });
  },

  /** Approve a pending payout (SUPER_ADMIN/MANAGER only). */
  approve(id: number) {
    return apiClient.put<OwnerPayoutDto>(`/accounting/payouts/${id}/approve`);
  },

  /** Mark a payout as manually paid with a reference (SEPA, virement externe…). */
  markAsPaid(id: number, request: MarkAsPaidRequest) {
    return apiClient.put<OwnerPayoutDto>(
      `/accounting/payouts/${id}/pay`,
      undefined,
      { params: { paymentReference: request.paymentReference } }
    );
  },

  /**
   * Exécute un payout via le rail configuré (Stripe Connect / Wise / Open Banking / SEPA).
   * Le PayoutExecutionService backend orchestre la stratégie selon `payoutMethod`.
   */
  execute(id: number) {
    return apiClient.post<OwnerPayoutDto>(`/accounting/payouts/${id}/execute`);
  },

  /** Retry une exécution payout en échec. */
  retry(id: number) {
    return apiClient.post<OwnerPayoutDto>(`/accounting/payouts/${id}/retry`);
  },

  /**
   * Envoie au proprietaire un releve email HTML resumant ses reversements
   * VERSES sur la periode demandee.
   *
   * Differenciateur conciergerie : permet de transmettre un rapport mensuel
   * professionnel a chaque proprietaire en 1 clic.
   */
  sendStatement(request: SendStatementRequest) {
    const query: Record<string, string> = {
      from: request.from,
      to: request.to,
    };
    return apiClient.post<SendStatementResult>(
      `/accounting/owners/${request.ownerId}/send-statement`,
      undefined,
      { params: query },
    );
  },
};

/** Helper UI : couleurs / labels par statut. */
export const PAYOUT_STATUS_META: Record<
  PayoutStatus,
  { label: string; color: string; icon: string }
> = {
  PENDING: { label: 'En attente', color: '#D97706', icon: 'time-outline' },
  APPROVED: { label: 'Approuvé', color: '#3B82F6', icon: 'checkmark-circle-outline' },
  EXECUTING: { label: 'En cours', color: '#3B82F6', icon: 'sync-outline' },
  PAID: { label: 'Versé', color: '#059669', icon: 'checkmark-done-circle' },
  FAILED: { label: 'Échec', color: '#EF4444', icon: 'close-circle' },
  CANCELLED: { label: 'Annulé', color: '#6B7280', icon: 'ban-outline' },
};

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  MANUAL: 'Manuel',
  STRIPE_CONNECT: 'Stripe Connect',
  SEPA_TRANSFER: 'SEPA',
  WISE: 'Wise',
  OPEN_BANKING: 'Open Banking',
};
