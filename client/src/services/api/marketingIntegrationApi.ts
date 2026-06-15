import apiClient from '../apiClient';

/** Vue de la config marketing (Brevo) — la clé n'est jamais renvoyée en clair. */
export interface MarketingIntegration {
  provider: string;
  configured: boolean;
  apiKeyMasked: string | null;
  waitlistListId: number | null;
  newsletterListId: number | null;
  prospectsListId: number | null;
  leadsListId: number | null;
  syncWaitlistEnabled: boolean;
  syncNewsletterEnabled: boolean;
  syncProspectsEnabled: boolean;
  syncLeadsEnabled: boolean;
  syncAttributesEnabled: boolean;
  status: 'UNCONFIGURED' | 'ACTIVE' | 'ERROR' | string;
  errorMessage: string | null;
  lastTestedAt: string | null;
}

export interface BrevoList {
  id: number;
  name: string;
  totalSubscribers: number | null;
}

export interface BrevoTestResult {
  success: boolean;
  message: string;
  listCount: number;
}

export interface MarketingListsPayload {
  waitlistListId: number | null;
  newsletterListId: number | null;
  prospectsListId: number | null;
  leadsListId: number | null;
}

export interface MarketingTogglesPayload {
  syncWaitlist?: boolean;
  syncNewsletter?: boolean;
  syncProspects?: boolean;
  syncLeads?: boolean;
  syncAttributes?: boolean;
}

const BASE = '/admin/marketing-integration';

/** Config marketing plateforme (Brevo) — réservé SUPER_ADMIN / SUPER_MANAGER. */
export const marketingIntegrationApi = {
  get(): Promise<MarketingIntegration> {
    return apiClient.get<MarketingIntegration>(BASE);
  },
  setApiKey(apiKey: string): Promise<MarketingIntegration> {
    return apiClient.put<MarketingIntegration>(`${BASE}/api-key`, { apiKey });
  },
  setLists(payload: MarketingListsPayload): Promise<MarketingIntegration> {
    return apiClient.put<MarketingIntegration>(`${BASE}/lists`, payload);
  },
  setToggles(payload: MarketingTogglesPayload): Promise<MarketingIntegration> {
    return apiClient.put<MarketingIntegration>(`${BASE}/toggles`, payload);
  },
  test(): Promise<BrevoTestResult> {
    return apiClient.post<BrevoTestResult>(`${BASE}/test`);
  },
  brevoLists(): Promise<BrevoList[]> {
    return apiClient.get<BrevoList[]>(`${BASE}/brevo-lists`);
  },
};
