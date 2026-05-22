/**
 * Client API pour les providers de tarification dynamique (PriceLabs, Beyond).
 * Mirror de {@code externalConnectionApi.ts} sur les routes /api/integrations/pricing/*.
 *
 * Endpoints backend :
 *   - POST   /api/integrations/pricing/{provider}/connect
 *   - GET    /api/integrations/pricing/{provider}/status
 *   - POST   /api/integrations/pricing/{provider}/disconnect
 */
import { API_CONFIG } from '../../config/api';
import { getItem, STORAGE_KEYS } from '../storageService';

function getAccessToken(): string | null {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export type PricingProvider = 'PRICELABS' | 'BEYOND';

export interface PricingConnectionRequest {
  serverUrl: string;
  accountIdentifier?: string;
  apiKey: string;
}

export interface PricingConnectionStatus {
  connected: boolean;
  providerType: PricingProvider;
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
    const error: Error & { status?: number; body?: unknown } = new Error(`Erreur ${response.status}`);
    error.status = response.status;
    try { error.body = await response.json(); } catch { /* ignore */ }
    throw error;
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return response.json();
}

export const pricingConnectionApi = {
  async connect(provider: PricingProvider, req: PricingConnectionRequest): Promise<PricingConnectionStatus> {
    return fetchJson(`/integrations/pricing/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getStatus(provider: PricingProvider): Promise<PricingConnectionStatus> {
    return fetchJson(`/integrations/pricing/${provider}/status`);
  },

  async disconnect(provider: PricingProvider): Promise<{ disconnected: boolean; provider: PricingProvider }> {
    return fetchJson(`/integrations/pricing/${provider}/disconnect`, { method: 'POST' });
  },
};

// ─── Provider metadata pour le rendering UI ─────────────────────────────────

export interface PricingProviderMeta {
  id: PricingProvider;
  label: string;
  description: string;
  brandColor: string;
  brandInitials: string;
  serverUrlPlaceholder: string;
  apiKeyHelpUrl?: string;
  accountIdentifierLabel?: string;
}

export const PRICING_PROVIDER_META: Record<PricingProvider, PricingProviderMeta> = {
  PRICELABS: {
    id: 'PRICELABS',
    label: 'PriceLabs',
    description:
      'Revenue management leader pour la location court-séjour. Recommandations de prix dynamiques, market intelligence, gestion automatique des min/max stays.',
    brandColor: '#E94F37',
    brandInitials: 'PL',
    serverUrlPlaceholder: 'https://api.pricelabs.co',
    apiKeyHelpUrl: 'https://docs.pricelabs.co/',
    accountIdentifierLabel: 'Account ID (optionnel)',
  },
  BEYOND: {
    id: 'BEYOND',
    label: 'Beyond',
    description:
      'Beyond Pricing — concurrent direct de PriceLabs, basé à San Francisco. Algorithme propriétaire de tarification optimisée nuit par nuit.',
    brandColor: '#0F2E3F',
    brandInitials: 'B',
    serverUrlPlaceholder: 'https://api.beyondpricing.com',
    apiKeyHelpUrl: 'https://help.beyondpricing.com/',
    accountIdentifierLabel: 'Account ID (optionnel)',
  },
};
