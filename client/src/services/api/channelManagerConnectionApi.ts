/**
 * Client API pour les Channel Managers (middleware d'agregation d'OTAs).
 * Routes /api/integrations/channel-manager/{provider}/{connect,status,disconnect}.
 *
 * <p>Distinction : les OTAs eux-memes (Airbnb, Booking.com, Vrbo) restent
 * dans la tab Channels. Cette API gere les middleware logiciels qui
 * agregent plusieurs OTAs.</p>
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export type ChannelManagerProvider = 'SITEMINDER' | 'HOSTAWAY' | 'RENTALS_UNITED' | 'CHANNEX';

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
  descriptionKey: string;
  serverUrlPlaceholder: string;
  apiKeyHelpUrl?: string;
  accountIdentifierLabelKey?: string;
}

export const CHANNEL_MANAGER_PROVIDER_META: Record<ChannelManagerProvider, ChannelManagerProviderMeta> = {
  SITEMINDER: {
    id: 'SITEMINDER',
    label: 'SiteMinder',
    descriptionKey: 'channelManagers.SITEMINDER.description',
    serverUrlPlaceholder: 'https://api.siteminder.com',
    apiKeyHelpUrl: 'https://developer.siteminder.com/',
    accountIdentifierLabelKey: 'channelManagers.SITEMINDER.accountLabel',
  },
  HOSTAWAY: {
    id: 'HOSTAWAY',
    label: 'Hostaway',
    descriptionKey: 'channelManagers.HOSTAWAY.description',
    serverUrlPlaceholder: 'https://api.hostaway.com',
    apiKeyHelpUrl: 'https://api.hostaway.com/documentation',
    accountIdentifierLabelKey: 'channelManagers.HOSTAWAY.accountLabel',
  },
  RENTALS_UNITED: {
    id: 'RENTALS_UNITED',
    label: 'Rentals United',
    descriptionKey: 'channelManagers.RENTALS_UNITED.description',
    serverUrlPlaceholder: 'https://api.rentalsunited.com',
    apiKeyHelpUrl: 'https://documentation.rentalsunited.com/',
    accountIdentifierLabelKey: 'channelManagers.RENTALS_UNITED.accountLabel',
  },
  CHANNEX: {
    id: 'CHANNEX',
    label: 'Channex',
    descriptionKey: 'channelManagers.CHANNEX.description',
    serverUrlPlaceholder: 'https://staging.channex.io/api/v1',
    apiKeyHelpUrl: 'https://docs.channex.io/api-reference',
    accountIdentifierLabelKey: 'channelManagers.CHANNEX.accountLabel',
  },
};
