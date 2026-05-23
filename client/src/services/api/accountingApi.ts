import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type PayoutGenerationType = 'MANUAL' | 'AUTO';
export type PayoutMethod =
  | 'MANUAL'
  | 'STRIPE_CONNECT'
  | 'SEPA_TRANSFER'
  | 'WISE'           // Wise Business — virements internationaux MA/KSA/+80 pays
  | 'OPEN_BANKING';  // Open Banking PIS — auto-SEPA depuis le compte Clenzy

export interface OwnerPayout {
  id: number;
  ownerId: number;
  ownerName: string | null;
  periodStart: string;
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
  paidAt: string | null;
  failureReason: string | null;
  retryCount: number;
  notes: string | null;
  createdAt: string;
}

export interface OwnerPayoutConfig {
  id: number;
  ownerId: number;
  payoutMethod: PayoutMethod;
  stripeConnectedAccountId: string | null;
  stripeOnboardingComplete: boolean;
  maskedIban: string | null;
  bic: string | null;
  bankAccountHolder: string | null;
  verified: boolean;
  // ─── Wise ───
  /** True si le recipient Wise a été créé pour cet owner. */
  wiseConfigured: boolean;
  // ─── Open Banking ───
  /** Provider PIS sélectionné : "GOCARDLESS" ou "TINK" (futur). */
  openBankingProvider: string | null;
  /** True si le consent SCA est valide (non expiré). */
  openBankingConsentActive: boolean;
  /** Date d'expiration du consent (ISO string) ou null. */
  openBankingConsentExpiresAt: string | null;
}

export interface OpenBankingInitRequest {
  /** ID de la banque chez GoCardless. Voir GET /api/v2/institutions/?country=FR. */
  institutionId: string;
  /** "GOCARDLESS" (seul supporté en MVP). */
  provider?: 'GOCARDLESS' | 'TINK';
}

export interface OpenBankingInitResponse {
  /** URL hébergée par GoCardless où l'admin signe le SCA bancaire. */
  redirectUrl: string;
  /** ID de requisition côté provider (retourné dans le callback). */
  requisitionId: string;
}

export interface OpenBankingInstitution {
  /** Identifiant GoCardless (ex: "BNP_PARIBAS_BNPAFRPP"). */
  id: string;
  /** Nom affichable de la banque (ex: "BNP Paribas"). */
  name: string;
  /** URL du logo (peut être null pour certaines banques). */
  logo: string | null;
}

export interface UpdateSepaRequest {
  /**
   * IBAN du compte destinataire. Optionnel : si non fourni (ou contient des `*`
   * = mask non modifié côté frontend), le backend conserve l'IBAN existant et
   * ne met à jour que les autres champs.
   */
  iban?: string;
  bic: string;
  bankAccountHolder: string;
}

export interface UpdateMethodRequest {
  payoutMethod: PayoutMethod;
}

export interface StripeConnectInitResponse {
  onboardingUrl: string;
  config: OwnerPayoutConfig;
}

export interface ChannelCommission {
  id?: number;
  channelName: string;
  commissionRate: number;
  organizationId?: number;
}

export interface PendingPayoutCount {
  pendingCount: number;
  totalPendingAmount: number;
}

export interface PayoutScheduleConfig {
  id: number;
  payoutDaysOfMonth: number[];
  gracePeriodDays: number;
  autoGenerateEnabled: boolean;
  updatedAt: string | null;
}

export interface UpdatePayoutScheduleRequest {
  payoutDaysOfMonth?: number[];
  gracePeriodDays?: number;
  autoGenerateEnabled?: boolean;
}

export interface SepaDebtorConfig {
  name: string | null;
  iban: string | null;
  bic: string | null;
  configured: boolean;
}

export interface UpdateSepaDebtorRequest {
  name?: string;
  iban?: string;
  bic?: string;
}

export const PAYOUT_STATUS_COLORS: Record<PayoutStatus, string> = {
  PENDING: '#D4A574',
  APPROVED: '#1976d2',
  PROCESSING: '#9c27b0',
  PAID: '#4A9B8E',
  FAILED: '#f44336',
  CANCELLED: '#d32f2f',
};

// ─── API ────────────────────────────────────────────────────────────────────

export const accountingApi = {
  async getPayouts(ownerId?: number, status?: PayoutStatus): Promise<OwnerPayout[]> {
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (ownerId) params.ownerId = ownerId;
    if (status) params.status = status;
    return apiClient.get<OwnerPayout[]>('/accounting/payouts', { params });
  },

  async getPayout(id: number): Promise<OwnerPayout> {
    return apiClient.get<OwnerPayout>(`/accounting/payouts/${id}`);
  },

  async generatePayout(ownerId: number, from: string, to: string): Promise<OwnerPayout> {
    return apiClient.post<OwnerPayout>('/accounting/payouts/generate', undefined, {
      params: { ownerId, from, to },
    });
  },

  async approvePayout(id: number): Promise<OwnerPayout> {
    return apiClient.put<OwnerPayout>(`/accounting/payouts/${id}/approve`);
  },

  async markAsPaid(id: number, paymentReference: string): Promise<OwnerPayout> {
    return apiClient.put<OwnerPayout>(`/accounting/payouts/${id}/pay`, undefined, {
      params: { paymentReference },
    });
  },

  async getPendingPayoutCount(): Promise<PendingPayoutCount> {
    return apiClient.get<PendingPayoutCount>('/accounting/payouts/pending-count');
  },

  async getMyPendingPayout(): Promise<PendingPayoutCount> {
    return apiClient.get<PendingPayoutCount>('/accounting/payouts/my-pending');
  },

  async getCommissions(): Promise<ChannelCommission[]> {
    return apiClient.get<ChannelCommission[]>('/accounting/commissions');
  },

  async saveCommission(channel: string, data: ChannelCommission): Promise<ChannelCommission> {
    return apiClient.put<ChannelCommission>(`/accounting/commissions/${channel}`, data);
  },

  // ─── Payout Execution ────────────────────────────────────────────────

  async executePayout(id: number): Promise<OwnerPayout> {
    return apiClient.post<OwnerPayout>(`/accounting/payouts/${id}/execute`);
  },

  async retryPayout(id: number): Promise<OwnerPayout> {
    return apiClient.post<OwnerPayout>(`/accounting/payouts/${id}/retry`);
  },

  // ─── Owner Payout Config ───────────────────────────────────────────

  async getOwnerPayoutConfig(ownerId: number): Promise<OwnerPayoutConfig> {
    return apiClient.get<OwnerPayoutConfig>(`/owner-payout-config/${ownerId}`);
  },

  async getAllOwnerPayoutConfigs(): Promise<OwnerPayoutConfig[]> {
    return apiClient.get<OwnerPayoutConfig[]>('/owner-payout-config');
  },

  async updatePayoutMethod(ownerId: number, data: UpdateMethodRequest): Promise<OwnerPayoutConfig> {
    return apiClient.put<OwnerPayoutConfig>(`/owner-payout-config/${ownerId}/method`, data);
  },

  async updateSepaDetails(ownerId: number, data: UpdateSepaRequest): Promise<OwnerPayoutConfig> {
    return apiClient.put<OwnerPayoutConfig>(`/owner-payout-config/${ownerId}/sepa`, data);
  },

  async verifyOwnerConfig(ownerId: number): Promise<OwnerPayoutConfig> {
    return apiClient.put<OwnerPayoutConfig>(`/owner-payout-config/${ownerId}/verify`);
  },

  // ─── Self-service (current user) ────────────────────────────────────

  async getMyPayoutConfig(): Promise<OwnerPayoutConfig> {
    return apiClient.get<OwnerPayoutConfig>('/owner-payout-config/me');
  },

  async updateMySepa(data: UpdateSepaRequest): Promise<OwnerPayoutConfig> {
    return apiClient.put<OwnerPayoutConfig>('/owner-payout-config/me/sepa', data);
  },

  async initMyStripeConnect(): Promise<StripeConnectInitResponse> {
    return apiClient.post<StripeConnectInitResponse>('/owner-payout-config/me/stripe-connect/init');
  },

  async getMyStripeOnboardingLink(): Promise<{ url: string }> {
    return apiClient.get<{ url: string }>('/owner-payout-config/me/stripe-connect/onboarding-link');
  },

  // ─── Open Banking SCA (self-service + admin) ──────────────────────────

  /**
   * Initie le flow SCA Open Banking pour le propriétaire courant.
   * Le frontend doit ensuite rediriger window.location vers redirectUrl.
   */
  async initMyOpenBanking(data: OpenBankingInitRequest): Promise<OpenBankingInitResponse> {
    return apiClient.post<OpenBankingInitResponse>('/owner-payout-config/me/openbanking/init', data);
  },

  /**
   * Variante admin pour initier le SCA pour un propriétaire spécifique
   * (utile quand le PMS gère le flow Open Banking au nom de l'host).
   */
  async initOpenBankingForOwner(ownerId: number, data: OpenBankingInitRequest): Promise<OpenBankingInitResponse> {
    return apiClient.post<OpenBankingInitResponse>(`/owner-payout-config/${ownerId}/openbanking/init`, data);
  },

  /**
   * Callback à appeler après le SCA bancaire. Le router frontend détecte le
   * marqueur ?openbanking=callback dans l'URL et invoque cet endpoint.
   * Le backend retrouve le requisitionId actif depuis la config de l'user.
   */
  async finalizeOpenBankingCallback(): Promise<OwnerPayoutConfig> {
    return apiClient.get<OwnerPayoutConfig>('/owner-payout-config/openbanking/callback');
  },

  /**
   * Liste les banques disponibles pour le SCA Open Banking par pays.
   * Renvoie une liste triée alphabétiquement avec id + name + logo.
   * Cache backend 1h, donc safe à appeler à chaque ouverture du dialog.
   */
  async listOpenBankingInstitutions(country: string = 'FR'): Promise<OpenBankingInstitution[]> {
    return apiClient.get<OpenBankingInstitution[]>(
      `/owner-payout-config/openbanking/institutions?country=${encodeURIComponent(country)}`);
  },

  // ─── Payout Schedule Config ───────────────────────────────────────────

  async getPayoutSchedule(): Promise<PayoutScheduleConfig> {
    return apiClient.get<PayoutScheduleConfig>('/settings/payout-schedule');
  },

  async updatePayoutSchedule(data: UpdatePayoutScheduleRequest): Promise<PayoutScheduleConfig> {
    return apiClient.put<PayoutScheduleConfig>('/settings/payout-schedule', data);
  },

  // ─── SEPA Debtor Config ───────────────────────────────────────────

  async getSepaDebtorConfig(): Promise<SepaDebtorConfig> {
    return apiClient.get<SepaDebtorConfig>('/settings/sepa-debtor');
  },

  async updateSepaDebtorConfig(data: UpdateSepaDebtorRequest): Promise<SepaDebtorConfig> {
    return apiClient.put<SepaDebtorConfig>('/settings/sepa-debtor', data);
  },
};
