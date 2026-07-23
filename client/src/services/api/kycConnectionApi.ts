/**
 * Client API pour les providers KYC / verification d'identite.
 * Routes /api/integrations/kyc/{provider}/{connect,status,disconnect}.
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export type KycProvider = 'SUMSUB' | 'VERIFF' | 'ONFIDO';

export interface KycConnectionRequest {
  serverUrl: string;
  accountIdentifier?: string;
  apiKey: string;
}

export interface KycConnectionStatus {
  connected: boolean;
  providerType: KycProvider;
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

export const kycConnectionApi = {
  async connect(provider: KycProvider, req: KycConnectionRequest): Promise<KycConnectionStatus> {
    return fetchJson(`/integrations/kyc/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getStatus(provider: KycProvider): Promise<KycConnectionStatus> {
    return fetchJson(`/integrations/kyc/${provider}/status`);
  },

  async disconnect(provider: KycProvider): Promise<{ disconnected: boolean; provider: KycProvider }> {
    return fetchJson(`/integrations/kyc/${provider}/disconnect`, { method: 'POST' });
  },
};

export interface KycProviderMeta {
  id: KycProvider;
  label: string;
  description: string;
  serverUrlPlaceholder: string;
  apiKeyHelpUrl?: string;
  accountIdentifierLabel?: string;
}

export const KYC_PROVIDER_META: Record<KycProvider, KycProviderMeta> = {
  SUMSUB: {
    id: 'SUMSUB',
    label: 'Sumsub',
    description:
      'Leader vérification d\'identité MENA + Europe. Accepté par les banques saoudiennes. KYC + KYB + transaction monitoring. Saisir l\'App Token ci-dessous et la Secret Key dans le champ API key : la paire signe chaque requête (HMAC).',
    serverUrlPlaceholder: 'https://api.sumsub.com',
    apiKeyHelpUrl: 'https://developers.sumsub.com/',
    accountIdentifierLabel: 'App Token (requis)',
  },
  VERIFF: {
    id: 'VERIFF',
    label: 'Veriff',
    description:
      'Vérification d\'identité estonienne, bon rapport qualité/prix. Couverture EU + MENA. Liveness + document check. Saisir l\'API key (publishable) ci-dessous et le Shared secret dans le champ API key : la paire signe chaque requête (HMAC).',
    serverUrlPlaceholder: 'https://stationapi.veriff.com',
    apiKeyHelpUrl: 'https://developers.veriff.com/',
    accountIdentifierLabel: 'API key publique (requis)',
  },
  ONFIDO: {
    id: 'ONFIDO',
    label: 'Onfido',
    description:
      'Vérification d\'identité premium globale. Qualité UX exceptionnelle, intégrée dans Revolut, Bolt, Zopa. ~95 % approval rate.',
    serverUrlPlaceholder: 'https://api.eu.onfido.com/v3.6',
    apiKeyHelpUrl: 'https://documentation.onfido.com/',
    accountIdentifierLabel: 'Workflow ID (optionnel)',
  },
};
