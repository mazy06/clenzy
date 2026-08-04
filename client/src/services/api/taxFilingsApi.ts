import apiClient from '../apiClient';

/** Déclaration de taxe de séjour d'un trimestre (registre, vague M-A). */
export interface TaxFiling {
  id: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: 'DUE' | 'FILED' | 'PAID';
  paymentReference: string | null;
}

export const taxFilingsApi = {
  list(): Promise<TaxFiling[]> {
    return apiClient.get<TaxFiling[]>('/tax-filings');
  },
  markFiled(id: number, reference?: string): Promise<void> {
    return apiClient.post<void>(`/tax-filings/${id}/mark-filed`, { reference: reference ?? '' });
  },
  markPaid(id: number, reference?: string): Promise<void> {
    return apiClient.post<void>(`/tax-filings/${id}/mark-paid`, { reference: reference ?? '' });
  },
};
