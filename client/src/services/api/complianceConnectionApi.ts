/**
 * Client API pour les providers de conformite legale (declaration voyageurs).
 * Mirror de {@code pricingConnectionApi.ts} sur les routes
 * /api/integrations/compliance/*.
 *
 * Endpoints backend :
 *   - POST   /api/integrations/compliance/{provider}/connect
 *   - GET    /api/integrations/compliance/{provider}/status
 *   - POST   /api/integrations/compliance/{provider}/disconnect
 */
import { API_CONFIG } from '../../config/api';
import { getItem, STORAGE_KEYS } from '../storageService';

function getAccessToken(): string | null {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export type ComplianceProvider = 'CHEKIN' | 'POLICE_MA' | 'ABSHER_KSA';

export interface ComplianceConnectionRequest {
  serverUrl: string;
  accountIdentifier?: string;
  apiKey: string;
}

export interface ComplianceConnectionStatus {
  connected: boolean;
  providerType: ComplianceProvider;
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

export const complianceConnectionApi = {
  async connect(provider: ComplianceProvider, req: ComplianceConnectionRequest): Promise<ComplianceConnectionStatus> {
    return fetchJson(`/integrations/compliance/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getStatus(provider: ComplianceProvider): Promise<ComplianceConnectionStatus> {
    return fetchJson(`/integrations/compliance/${provider}/status`);
  },

  async disconnect(provider: ComplianceProvider): Promise<{ disconnected: boolean; provider: ComplianceProvider }> {
    return fetchJson(`/integrations/compliance/${provider}/disconnect`, { method: 'POST' });
  },
};

// ─── Provider metadata pour le rendering UI ─────────────────────────────────

export interface ComplianceProviderMeta {
  id: ComplianceProvider;
  label: string;
  description: string;
  brandColor: string;
  brandInitials: string;
  serverUrlPlaceholder: string;
  apiKeyHelpUrl?: string;
  accountIdentifierLabel?: string;
  /** Code pays ISO (FR, MA, SA) pour affichage du chip pays. */
  countryCode: 'FR' | 'MA' | 'SA';
  /** Court rappel de l'obligation legale couverte. */
  legalNote: string;
}

export const COMPLIANCE_PROVIDER_META: Record<ComplianceProvider, ComplianceProviderMeta> = {
  CHEKIN: {
    id: 'CHEKIN',
    label: 'Chekin',
    description:
      'SaaS d\'automatisation de la fiche individuelle de police (CERFA 11253*04) pour les voyageurs étrangers. Aussi disponible Espagne, Italie, Portugal.',
    brandColor: '#1E40AF',
    brandInitials: 'CK',
    serverUrlPlaceholder: 'https://api.chekin.com',
    apiKeyHelpUrl: 'https://docs.chekin.com/',
    accountIdentifierLabel: 'Account ID (optionnel)',
    countryCode: 'FR',
    legalNote: 'Fiche police France (CERFA 11253*04, obligatoire non-résidents UE)',
  },
  POLICE_MA: {
    id: 'POLICE_MA',
    label: 'Police Maroc (DGSN)',
    description:
      'Connecteur direct DGSN — Direction Générale de la Sûreté Nationale. Déclaration obligatoire des voyageurs dès la 1ère nuit, contrôle régulier par les autorités locales.',
    brandColor: '#C1272D',
    brandInitials: 'MA',
    serverUrlPlaceholder: 'https://portal.dgsn.gov.ma',
    accountIdentifierLabel: 'Établissement ID',
    countryCode: 'MA',
    legalNote: 'Fiche d\'identification voyageur (DGSN, obligatoire)',
  },
  ABSHER_KSA: {
    id: 'ABSHER_KSA',
    label: 'Absher (Arabie Saoudite)',
    description:
      'Plateforme nationale Absher — Ministère de l\'Intérieur saoudien. Enregistrement obligatoire des voyageurs non-résidents. Connecté à Tawakkalna pour les contrôles.',
    brandColor: '#006C35',
    brandInitials: 'KSA',
    serverUrlPlaceholder: 'https://api.absher.sa',
    accountIdentifierLabel: 'Establishment ID',
    countryCode: 'SA',
    legalNote: 'Enregistrement MOI + Tawakkalna (obligatoire non-résidents)',
  },
};
