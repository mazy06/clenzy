import apiClient from '../apiClient';
import type { QuoteLine } from './interventionsApi';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export type { QuoteLine };

export interface QuoteCancellationView {
  canCancel: boolean; missionVersion: number | null; unavailableReason: string | null;
  reason: string | null; cancelledAt: string | null;
}

export interface QuoteAgreement {
  quoteId: number; originalAmount: number; agreedAmount: number; currency: string; amendmentId: number | null;
}
export interface QuoteAmendment {
  id: number; version: number; quoteId: number; interventionId: number;
  originalAmount: number; proposedAmount: number; currency: string; reason: string;
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'OBSOLETE';
  proposedBy: number; createdAt: string; decidedBy: number | null; decidedAt: string | null;
}
export interface QuoteAmendmentAccess {
  actorId: number; canPropose: boolean; canDecide: boolean; canAccept: boolean; canWithdrawOwn: boolean;
}
export interface QuoteAmendmentArchive {
  id: number; quoteId: number; interventionId: number; originalAmount: number; proposedAmount: number;
  currency: string; reason: string; decidedAt: string; archivedAt: string | null;
  archiveStatus: 'READY' | 'PREPARING' | 'RETRYING';
}
export interface QuoteAmendmentArchivePage {
  content: QuoteAmendmentArchive[]; totalElements: number; totalPages: number; number: number; size: number;
}

/** Devis prestataire d'une intervention (fiche intervention > Devis, M4). */
export interface ServiceQuote {
  id: number;
  interventionId: number | null;
  providerName: string;
  providerEmail: string | null;
  providerPhone: string | null;
  amount: number;
  currency: string;
  validUntil: string | null;
  earliestStartDate: string | null;
  description: string | null;
  status: 'RECEIVED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  /** Intervenant qui a soumis le devis. `null` = saisi par un gestionnaire. */
  providerUserId: number | null;
  /** PDF du devis. `null` si la génération a échoué (modèle absent, par ex.). */
  documentGenerationId: number | null;
  depositAmount?: number | null;
  depositPercent?: number | null;
  /** Détail chiffré : ce que le total recouvre. Vide pour un devis saisi à la main. */
  lines: QuoteLine[];
}


/** Devis vu par son auteur : la mission, et où en est l'argent. */
export interface MyQuote {
  id: number;
  interventionId: number;
  interventionTitle: string | null;
  /** Référence du devis : numéro légal du PDF, ou repli sur l'identifiant. */
  reference: string | null;
  propertyName: string | null;
  propertyAddress: string | null;
  /** À qui le devis est adressé. */
  ownerName: string | null;
  /** La conciergerie qui gère le bien. */
  agencyName: string | null;
  /** Nature de la prestation : travaux, ménage… */
  interventionType: string | null;
  scheduledDate: string | null;
  interventionStatus: string | null;
  amount: number;
  currency: string;
  validUntil: string | null;
  description: string | null;
  status: ServiceQuote['status'];
  depositAmount: number | null;
  /** `UNPAID`, `DEPOSIT_PAID` ou `PAID`. */
  paymentState: 'UNPAID' | 'DEPOSIT_PAID' | 'PAID';
}

export type ServiceQuoteRequest = Omit<ServiceQuote,
  'id' | 'interventionId' | 'status' | 'providerUserId' | 'documentGenerationId'>;

/** Tarif approuvé pour un logement — l'accord en vigueur. */
export interface AgreedRate {
  propertyId: number;
  amount: number;
  currency: string;
  agreedAt: string;
}

export const serviceQuotesApi = {
  cancellation(id: number): Promise<QuoteCancellationView> {
    return apiClient.get(`/service-quotes/${id}/cancellation`);
  },
  cancelAgreement(id: number, missionVersion: number | null, reason: string): Promise<QuoteCancellationView> {
    return apiClient.post(`/service-quotes/${id}/cancellation`, { missionVersion, reason });
  },
  amendmentArchives(page: number, size: number, search: string): Promise<QuoteAmendmentArchivePage> {
    return apiClient.get('/service-quote-amendments/archives', { params: { page, size, search } });
  },
  async downloadAmendment(id: number): Promise<void> {
    const token = getAccessToken();
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/service-quote-amendments/${id}/pdf`, {
      credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
      throw new Error('AMENDMENT_PDF_UNAVAILABLE');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    try {
      link.href = url;
      link.download = `baitly-avenant-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },
  agreement(id: number): Promise<QuoteAgreement> {
    return apiClient.get(`/service-quotes/${id}/agreement`);
  },
  amendments(id: number): Promise<QuoteAmendment[]> {
    return apiClient.get(`/service-quotes/${id}/amendments`);
  },
  amendmentAccess(id: number): Promise<QuoteAmendmentAccess> {
    return apiClient.get(`/service-quotes/${id}/amendment-access`);
  },
  proposeAmendment(id: number, amount: number, reason: string): Promise<QuoteAmendment> {
    return apiClient.post(`/service-quotes/${id}/amendments`, { amount, reason });
  },
  decideAmendment(id: number, version: number, decision: 'accept' | 'reject' | 'withdraw'): Promise<QuoteAmendment> {
    return apiClient.post(`/service-quote-amendments/${id}/${decision}`, { version });
  },
  list(interventionId: number): Promise<ServiceQuote[]> {
    return apiClient.get<ServiceQuote[]>(`/interventions/${interventionId}/quotes`);
  },

  /**
   * Mes tarifs CONVENUS par logement : les devis déjà approuvés.
   *
   * <p>Tant que mon tarif configuré égale celui-ci, l'accord tient et il n'y a
   * pas de nouveau devis à proposer.</p>
   */
  myAgreedRates(): Promise<AgreedRate[]> {
    return apiClient.get<AgreedRate[]>('/service-quotes/my-agreed-rates');
  },

  /** Mes devis — l'auteur est résolu depuis le JWT côté serveur. */
  listMine(): Promise<MyQuote[]> {
    return apiClient.get<MyQuote[]>('/service-quotes/mine');
  },

  /**
   * Soumettre MON devis. Le nom et l'email du prestataire viennent du compte
   * connecté : `create` laisse au contraire l'appelant les écrire, ce qui n'a
   * de sens que pour un gestionnaire saisissant un devis externe.
   */
  submitMine(interventionId: number, request: Pick<ServiceQuoteRequest,
    'amount' | 'currency' | 'validUntil' | 'earliestStartDate' | 'description' | 'lines'>): Promise<ServiceQuote> {
    return apiClient.post<ServiceQuote>(`/interventions/${interventionId}/quotes/mine`, request);
  },
  create(interventionId: number, request: ServiceQuoteRequest): Promise<ServiceQuote> {
    return apiClient.post<ServiceQuote>(`/interventions/${interventionId}/quotes`, request);
  },
  /** Écarte CE devis sans en retenir un autre. */
  reject(id: number): Promise<ServiceQuote> {
    return apiClient.post<ServiceQuote>(`/service-quotes/${id}/reject`, {});
  },

  /** Approuve CE devis : les concurrents passent REJECTED, le coût est reporté sur l'intervention. */
  approve(id: number): Promise<ServiceQuote> {
    return apiClient.post<ServiceQuote>(`/service-quotes/${id}/approve`, {});
  },
  remove(id: number): Promise<void> {
    return apiClient.delete<void>(`/service-quotes/${id}`);
  },
};
