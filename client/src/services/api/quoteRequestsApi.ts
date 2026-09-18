import apiClient from '../apiClient';
import type { ServiceQuote } from './serviceQuotesApi';

/**
 * Demandes de devis — les deux côtés.
 *
 * `/sent` pour ce que mon organisation a envoyé, `/received` pour ce qui est
 * adressé à ma fiche de prestataire. Deux chemins et non un paramètre « côté » :
 * ce dernier aurait laissé lire l'autre colonne en changeant un mot dans l'URL.
 */

const BASE = '/quote-requests';

export interface QuoteRecurrence {
  version: number;
  enabled: boolean;
  firstDate: string;
  intervalUnit: 'DAYS' | 'MONTHS';
  intervalCount: number;
  leadDays: number;
  nextDate: string;
  lastRequestId: number | null;
}
export type RecurrenceCommand = Omit<QuoteRecurrence, 'version' | 'nextDate' | 'lastRequestId'> & { version: number | null };

export type QuoteRequestStatus =
  | 'SENT' | 'QUOTED' | 'ACCEPTED' | 'DECLINED'
  | 'TURNED_DOWN' | 'WITHDRAWN' | 'EXPIRED';

export interface QuoteRequestDto {
  replacesQuoteId?: number | null;
  requestedStartTime?: string | null;
  requestedDurationMinutes?: number | null;
  id: number;
  status: QuoteRequestStatus;

  providerId: number;
  providerName?: string;
  requesterOrganizationId: number;
  requesterOrganizationName?: string;

  propertyId?: number;
  categoryCode?: string;
  serviceItemCode?: string;
  title: string;
  message?: string;
  desiredDate?: string;

  quotedAmount?: number;
  quotedCurrency?: string;
  quoteMessage?: string;
  quoteValidUntil?: string;
  quotedAt?: string;
  /** Vrai si la date de validité est passée : l'écran le dit avant le clic. */
  expired: boolean;

  decidedAt?: string;
  decisionReason?: string;
  interventionId?: number;

  createdAt: string;
}

export interface QuotePageDto {
  items: QuoteRequestDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateQuotePayload {
  providerId: number;
  title: string;
  message?: string;
  propertyId?: number | null;
  categoryCode?: string;
  serviceItemCode?: string;
  desiredDate?: string | null;
}

function listQuery(status: QuoteRequestStatus[] | undefined, page: number, size: number): string {
  const search = new URLSearchParams();
  (status ?? []).forEach((value) => search.append('status', value));
  search.append('page', String(page));
  search.append('size', String(size));
  return `?${search.toString()}`;
}

export const quoteRequestsApi = {
  review(id: number) {
    return apiClient.get<{ canReview: boolean; rating: number | null; feedback: string | null; createdAt: string | null }>(`${BASE}/${id}/review`);
  },
  submitReview(id: number, rating: number, feedback: string) {
    return apiClient.post(`${BASE}/${id}/review`, { rating, feedback });
  },
  async recurrence(id: number) {
    const response = await apiClient.get<{ schedule: QuoteRecurrence | null }>(`${BASE}/${id}/recurrence`);
    return response.schedule;
  },
  configureRecurrence(id: number, command: RecurrenceCommand) {
    return apiClient.put<QuoteRecurrence>(`${BASE}/${id}/recurrence`, command);
  },
  teams(id: number) {
    return apiClient.get<{ selectedTeamId: number | null; options: { id: number; name: string }[] }>(`${BASE}/${id}/teams`);
  },
  commercial(id: number) {
    return apiClient.get<ServiceQuote>(`${BASE}/${id}/commercial`);
  },
  create(payload: CreateQuotePayload) {
    return apiClient.post<QuoteRequestDto>(BASE, payload);
  },
  replace(quoteId: number, providerId: number, desiredDate?: string | null, categoryCode?: string, serviceItemCode?: string) {
    return apiClient.post<QuoteRequestDto>(`/service-quotes/${quoteId}/replacement`, { providerId, desiredDate, categoryCode, serviceItemCode });
  },

  sent(status?: QuoteRequestStatus[], page = 0, size = 20) {
    return apiClient.get<QuotePageDto>(`${BASE}/sent${listQuery(status, page, size)}`);
  },

  received(status?: QuoteRequestStatus[], page = 0, size = 20) {
    return apiClient.get<QuotePageDto>(`${BASE}/received${listQuery(status, page, size)}`);
  },

  pendingCount() {
    return apiClient.get<{ count: number }>(`${BASE}/received/pending-count`);
  },

  getById(id: number) {
    return apiClient.get<QuoteRequestDto>(`${BASE}/${id}`);
  },

  accept(id: number) {
    return apiClient.post<QuoteRequestDto>(`${BASE}/${id}/accept`);
  },

  decline(id: number, reason?: string) {
    return apiClient.post<QuoteRequestDto>(`${BASE}/${id}/decline`, { reason });
  },

  withdraw(id: number, reason?: string) {
    return apiClient.post<QuoteRequestDto>(`${BASE}/${id}/withdraw`, { reason });
  },

  /** Le montant part d'ici — c'est le prestataire qui chiffre. */
  quote(id: number, amount: number, currency: string, message?: string, validUntil?: string, providerTeamId?: number) {
    return apiClient.post<QuoteRequestDto>(`${BASE}/${id}/quote`, {
      amount, currency, message, validUntil, providerTeamId,
    });
  },

  turnDown(id: number, reason?: string) {
    return apiClient.post<QuoteRequestDto>(`${BASE}/${id}/turn-down`, { reason });
  },
};
