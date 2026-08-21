import apiClient from '../apiClient';
import type { QuoteLine } from './interventionsApi';

export type { QuoteLine };

/** Devis prestataire d'une intervention (fiche intervention > Devis, M4). */
export interface ServiceQuote {
  id: number;
  interventionId: number;
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
