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
}

export type ServiceQuoteRequest = Omit<ServiceQuote, 'id' | 'interventionId' | 'status'>;

export const serviceQuotesApi = {
  list(interventionId: number): Promise<ServiceQuote[]> {
    return apiClient.get<ServiceQuote[]>(`/interventions/${interventionId}/quotes`);
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
