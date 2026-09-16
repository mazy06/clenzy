import apiClient from '../apiClient';
import type { ServiceQuote } from './serviceQuotesApi';

export interface Proposal {
  id: number; requestId: number; organizationId: number; cycle: number;
  targetType: 'team' | 'user'; targetId: number; origin: string;
  status: 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';
  createdAt: string; expiresAt: string; respondedAt: string | null; reason: string | null;
}
export interface ProposalInboxItem {
  proposal: Proposal; title: string; serviceItemCode: string; city: string | null;
  scheduledAt: string; durationHours: number | null; terms: { amount: number; currency: string; tariffId: number } | null;
  providerTerms?: { amount: number; currency: string; tariffId: number | null } | null;
}
export interface PublicNeed {
  id: number; serviceItemCode: string; city: string | null; country: string | null;
  date: string; durationHours: number | null;
}
export interface AssignmentCard {
  requestId: number; proposal: Proposal | null;
  price: { amount: number; currency: string; tariffId: number | null } | null;
  quote: boolean; estimate: number | null;
  estimateCurrency?: string | null;
  offeredPrice?: { amount: number; currency: string; tariffId: number | null } | null;
}
export interface AssignmentContactPreferences { fromHour: number; untilHour: number; criticalOnCall: boolean; }

export interface AssignmentPolicy {
  enabled: boolean; publicSearch: boolean; timezone: string; contactFromHour: number; contactUntilHour: number;
  deadlines: { distantMinutes: number; standardMinutes: number; imminentMinutes: number; criticalMinutes: number; unscheduledMinutes: number; preparationMinutes: number };
}
export const serviceAssignmentsApi = {
  cards: (ids: number[]) => apiClient.get<AssignmentCard[]>('/service-assignments/cards', { params: { ids: ids.join(',') } }),
  quotes: (id: number) => apiClient.get<ServiceQuote[]>(`/service-assignments/requests/${id}/quotes`),
  quote: (proposal: Proposal, offer: { amount: number; currency: string; validUntil: string; description: string }) =>
    apiClient.post<number>(`/service-assignments/requests/${proposal.requestId}/proposals/${proposal.id}/quote`, offer),
  inbox: (page: number) => apiClient.get<ProposalInboxItem[]>('/service-assignments/inbox', { params: { page } }),
  respond: (proposal: Proposal, accept: boolean, reason?: string) => apiClient.post<{ status: string; interventionId: number | null }>(
    `/service-assignments/requests/${proposal.requestId}/proposals/${proposal.id}/response`, { accept, reason }),
  history: (id: number) => apiClient.get<Proposal[]>(`/service-assignments/requests/${id}/history`),
  resume: (id: number) => apiClient.post(`/service-assignments/requests/${id}/resume`),
  publicNeeds: (cursor?: number) => apiClient.get<{ items: PublicNeed[]; nextCursor: number | null }>('/service-assignments/public', { params: { cursor } }),
  offer: (id: number, offer: { amount: number; currency: string; message: string; validUntil: string }) => apiClient.post<number>(`/service-assignments/public/${id}/offers`, offer),
  contacts: () => apiClient.get<AssignmentContactPreferences>('/service-assignments/contact-preferences'),
  saveContacts: (value: AssignmentContactPreferences) => apiClient.put<AssignmentContactPreferences>('/service-assignments/contact-preferences', value),
  policy: () => apiClient.get<AssignmentPolicy>('/service-assignments/policy'),
  savePolicy: (policy: AssignmentPolicy) => apiClient.put<AssignmentPolicy>('/service-assignments/policy', policy),
};
