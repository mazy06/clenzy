import apiClient from '../apiClient';

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
}

export type ServiceQuoteRequest = Omit<ServiceQuote, 'id' | 'interventionId' | 'status' | 'providerUserId'>;

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
  listMine(): Promise<ServiceQuote[]> {
    return apiClient.get<ServiceQuote[]>('/service-quotes/mine');
  },

  /**
   * Soumettre MON devis. Le nom et l'email du prestataire viennent du compte
   * connecté : `create` laisse au contraire l'appelant les écrire, ce qui n'a
   * de sens que pour un gestionnaire saisissant un devis externe.
   */
  submitMine(interventionId: number, request: Pick<ServiceQuoteRequest,
    'amount' | 'currency' | 'validUntil' | 'earliestStartDate' | 'description'>): Promise<ServiceQuote> {
    return apiClient.post<ServiceQuote>(`/interventions/${interventionId}/quotes/mine`, request);
  },
  create(interventionId: number, request: ServiceQuoteRequest): Promise<ServiceQuote> {
    return apiClient.post<ServiceQuote>(`/interventions/${interventionId}/quotes`, request);
  },
  /** Approuve CE devis : les concurrents passent REJECTED, le coût est reporté sur l'intervention. */
  approve(id: number): Promise<ServiceQuote> {
    return apiClient.post<ServiceQuote>(`/service-quotes/${id}/approve`, {});
  },
  remove(id: number): Promise<void> {
    return apiClient.delete<void>(`/service-quotes/${id}`);
  },
};
