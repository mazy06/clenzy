import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'EXPIRED';
/** Statut de la demande de signature électronique du mandat (workflow SES interne). */
export type ContractSignatureStatus = 'PENDING' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
export type ContractType = 'FULL_MANAGEMENT' | 'BOOKING_ONLY' | 'MAINTENANCE_ONLY' | 'CUSTOM';
/** Modèle de flux/répartition (taxonomie OTA). DIRECT = Clenzy encaisse via Stripe. */
export type PaymentModel = 'DIRECT' | 'OWNER_COLLECTS' | 'CONCIERGE_COLLECTS' | 'OTA_COHOST_SPLIT';
/** Base de calcul de la commission : brut, ou net des frais OTA. */
export type CommissionBase = 'GROSS' | 'NET_OF_OTA_FEE';

export interface ManagementContract {
  id: number;
  propertyId: number;
  ownerId: number;
  contractNumber: string;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  commissionRate: number;
  /** Part conciergerie sur les upsells (fraction) ; null = défaut org. */
  upsellCommissionRate: number | null;
  /** Part conciergerie sur les activités/marketplace (fraction) ; null = défaut org. */
  activityCommissionRate: number | null;
  /** Modèle de flux/répartition (taxonomie OTA). */
  paymentModel: PaymentModel;
  /** Base de calcul de la commission. */
  commissionBase: CommissionBase;
  minimumStayNights: number | null;
  autoRenew: boolean;
  noticePeriodDays: number;
  cleaningFeeIncluded: boolean;
  maintenanceIncluded: boolean;
  notes: string | null;
  signedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  createdAt: string;
  /** null = aucune demande de signature (contrat antérieur ou propriétaire sans email). */
  signatureStatus: ContractSignatureStatus | null;
}

export interface CreateManagementContractRequest {
  propertyId: number;
  ownerId: number;
  contractType: ContractType;
  startDate: string;
  endDate?: string | null;
  commissionRate: number;
  upsellCommissionRate?: number | null;
  activityCommissionRate?: number | null;
  paymentModel?: PaymentModel;
  commissionBase?: CommissionBase;
  minimumStayNights?: number | null;
  autoRenew?: boolean;
  noticePeriodDays?: number;
  cleaningFeeIncluded?: boolean;
  maintenanceIncluded?: boolean;
  notes?: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const managementContractsApi = {
  async getAll(params?: {
    propertyId?: number;
    ownerId?: number;
    status?: ContractStatus;
  }): Promise<ManagementContract[]> {
    const query = new URLSearchParams();
    if (params?.propertyId) query.set('propertyId', String(params.propertyId));
    if (params?.ownerId) query.set('ownerId', String(params.ownerId));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return apiClient.get<ManagementContract[]>(
      `/management-contracts${qs ? `?${qs}` : ''}`
    );
  },

  async getById(id: number): Promise<ManagementContract> {
    return apiClient.get<ManagementContract>(`/management-contracts/${id}`);
  },

  async create(data: CreateManagementContractRequest): Promise<ManagementContract> {
    return apiClient.post<ManagementContract>('/management-contracts', data);
  },

  async update(id: number, data: CreateManagementContractRequest): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}`, data);
  },

  async activate(id: number): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}/activate`, {});
  },

  async suspend(id: number): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}/suspend`, {});
  },

  async terminate(id: number, reason: string): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}/terminate`, { reason });
  },

  async expireAll(): Promise<{ expired: number }> {
    return apiClient.post<{ expired: number }>('/management-contracts/expire', {});
  },

  /** Renvoie le lien de signature au propriétaire (contrats DRAFT uniquement). */
  async resendSignature(id: number): Promise<ManagementContract> {
    return apiClient.post<ManagementContract>(`/management-contracts/${id}/signature/resend`, {});
  },

  /**
   * Ouvre le mandat PDF dans un nouvel onglet : version SIGNÉE (avec certificat)
   * si elle existe, sinon l'original. Rejette avec le status HTTP si indisponible
   * (404 = aucun mandat généré — l'appelant peut générer à la volée).
   */
  async viewMandate(id: number): Promise<void> {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/management-contracts/${id}/mandate`;
    const token = getAccessToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    const blob = await response.blob();
    window.open(window.URL.createObjectURL(blob), '_blank');
  },
};
