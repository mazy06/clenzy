/**
 * Client API pour les Channel Managers (middleware d'agregation d'OTAs).
 * Routes /api/integrations/channel-manager/{provider}/{connect,status,disconnect}.
 *
 * <p>Distinction : les OTAs eux-memes (Airbnb, Booking.com, Vrbo) restent
 * dans la tab Channels. Cette API gere les middleware logiciels qui
 * agregent plusieurs OTAs.</p>
 */
import { API_CONFIG } from '../../config/api';
import { getItem, STORAGE_KEYS } from '../storageService';

function getAccessToken(): string | null {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export type ChannelManagerProvider = 'SITEMINDER' | 'HOSTAWAY' | 'RENTALS_UNITED';

export interface ChannelManagerConnectionRequest {
  serverUrl: string;
  accountIdentifier?: string;
  apiKey: string;
}

export interface ChannelManagerConnectionStatus {
  connected: boolean;
  providerType: ChannelManagerProvider;
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

export const channelManagerConnectionApi = {
  async connect(provider: ChannelManagerProvider, req: ChannelManagerConnectionRequest): Promise<ChannelManagerConnectionStatus> {
    return fetchJson(`/integrations/channel-manager/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getStatus(provider: ChannelManagerProvider): Promise<ChannelManagerConnectionStatus> {
    return fetchJson(`/integrations/channel-manager/${provider}/status`);
  },

  async disconnect(provider: ChannelManagerProvider): Promise<{ disconnected: boolean; provider: ChannelManagerProvider }> {
    return fetchJson(`/integrations/channel-manager/${provider}/disconnect`, { method: 'POST' });
  },
};

export interface ChannelManagerProviderMeta {
  id: ChannelManagerProvider;
  label: string;
  description: string;
  serverUrlPlaceholder: string;
  apiKeyHelpUrl?: string;
  accountIdentifierLabel?: string;
}

export const CHANNEL_MANAGER_PROVIDER_META: Record<ChannelManagerProvider, ChannelManagerProviderMeta> = {
  SITEMINDER: {
    id: 'SITEMINDER',
    label: 'SiteMinder',
    description:
      'Channel manager leader mondial (Australie). ~250 OTAs intégrés y compris des marchés niches MENA / Asie / LATAM.',
    serverUrlPlaceholder: 'https://api.siteminder.com',
    apiKeyHelpUrl: 'https://developer.siteminder.com/',
    accountIdentifierLabel: 'Property ID (optionnel)',
  },
  HOSTAWAY: {
    id: 'HOSTAWAY',
    label: 'Hostaway',
    description:
      'Channel manager STR (US), focus court-séjour. Intégration native Airbnb + Booking + Vrbo + Expedia.',
    serverUrlPlaceholder: 'https://api.hostaway.com',
    apiKeyHelpUrl: 'https://api.hostaway.com/documentation',
    accountIdentifierLabel: 'Account ID (optionnel)',
  },
  RENTALS_UNITED: {
    id: 'RENTALS_UNITED',
    label: 'Rentals United',
    description:
      'Channel manager STR (Espagne). 60+ OTAs y compris marchés MENA et Europe. Très utilisé en France et Maroc.',
    serverUrlPlaceholder: 'https://api.rentalsunited.com',
    apiKeyHelpUrl: 'https://documentation.rentalsunited.com/',
    accountIdentifierLabel: 'Owner ID (optionnel)',
  },
};
