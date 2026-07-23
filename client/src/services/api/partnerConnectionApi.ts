/**
 * Client API pour les connexions aux services partenaires du catalogue
 * Intégrations (marketing/CRM, ménage, avis, fiscalité, assurance).
 * Routes /api/integrations/partner/{provider}/{connect,status,disconnect}.
 *
 * Scaffolding : le backend valide la forme des credentials et les stocke
 * chiffrées — aucun appel API partenaire n'est encore effectué. Les flux
 * métier seront branchés provider par provider (même trajectoire que Chekin).
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export type PartnerServiceProvider =
  | 'MAILCHIMP' | 'KLAVIYO' | 'PIPEDRIVE'
  | 'TURNO' | 'PROPERLY' | 'BREEZEWAY'
  | 'MYTSE' | 'AVALARA' | 'EFACTURE_DGI_MA'
  | 'SUPERHOG' | 'SAFELY' | 'AXA_PARTNERS' | 'TAWUNIYA'
  | 'REVINATE' | 'TRUSTYOU' | 'HIJIFFY'
  | 'ZAPIER' | 'MAKE'
  | 'DUVE' | 'ENSO_CONNECT';

const PARTNER_PROVIDERS: readonly PartnerServiceProvider[] = [
  'MAILCHIMP', 'KLAVIYO', 'PIPEDRIVE',
  'TURNO', 'PROPERLY', 'BREEZEWAY',
  'MYTSE', 'AVALARA', 'EFACTURE_DGI_MA',
  'SUPERHOG', 'SAFELY', 'AXA_PARTNERS', 'TAWUNIYA',
  'REVINATE', 'TRUSTYOU', 'HIJIFFY',
  'ZAPIER', 'MAKE',
  'DUVE', 'ENSO_CONNECT',
] as const;

/** Mappe un id du catalogue (minuscules) vers le provider backend, sinon null. */
export function partnerProviderFromCatalogId(catalogId: string): PartnerServiceProvider | null {
  const candidate = catalogId.toUpperCase() as PartnerServiceProvider;
  return PARTNER_PROVIDERS.includes(candidate) ? candidate : null;
}

export interface PartnerConnectionRequest {
  serverUrl: string;
  accountIdentifier?: string;
  apiKey: string;
}

export interface PartnerConnectionStatus {
  connected: boolean;
  providerType: PartnerServiceProvider;
  serverUrl?: string | null;
  accountIdentifier?: string | null;
  status?: string | null;
  lastTestedAt?: string | null;
  connectedAt?: string | null;
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}`;
  const token = getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error: Error & { status?: number } = new Error(`Erreur ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return response.json();
}

export const partnerConnectionApi = {
  async connect(provider: PartnerServiceProvider, req: PartnerConnectionRequest): Promise<PartnerConnectionStatus> {
    return fetchJson(`/integrations/partner/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getStatus(provider: PartnerServiceProvider): Promise<PartnerConnectionStatus> {
    return fetchJson(`/integrations/partner/${provider}/status`);
  },

  async disconnect(provider: PartnerServiceProvider): Promise<{ disconnected: boolean; provider: PartnerServiceProvider }> {
    return fetchJson(`/integrations/partner/${provider}/disconnect`, { method: 'POST' });
  },
};
