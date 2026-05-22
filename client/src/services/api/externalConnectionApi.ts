/**
 * Client API unifie pour les providers de signature electronique base sur API key
 * (Yousign, Universign, DocaPoste, Odoo).
 *
 * Pennylane et DocuSign ont leurs propres clients (OAuth2) — voir pennylaneApi.ts
 * et (a venir) docusignApi.ts.
 *
 * Endpoints backend :
 *   - POST   /api/integrations/external/{provider}/connect
 *   - GET    /api/integrations/external/{provider}/status
 *   - POST   /api/integrations/external/{provider}/disconnect
 */
import { API_CONFIG } from '../../config/api';
import { getItem, STORAGE_KEYS } from '../storageService';
import type { SignatureProvider } from './integrationsApi';

function getAccessToken(): string | null {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/** Providers supportes par cette API (rejette les autres). */
export type ApiKeyProvider = Extract<
  SignatureProvider,
  'YOUSIGN' | 'UNIVERSIGN' | 'DOCAPOSTE' | 'ODOO'
>;

export interface ExternalConnectionRequest {
  serverUrl: string;
  /** Optionnel : nom de tenant, account id, db name selon le provider. */
  accountIdentifier?: string;
  apiKey: string;
}

export interface ExternalConnectionStatus {
  connected: boolean;
  providerType: ApiKeyProvider;
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

export const externalConnectionApi = {
  async connect(provider: ApiKeyProvider, req: ExternalConnectionRequest): Promise<ExternalConnectionStatus> {
    return fetchJson(`/integrations/external/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getStatus(provider: ApiKeyProvider): Promise<ExternalConnectionStatus> {
    return fetchJson(`/integrations/external/${provider}/status`);
  },

  async disconnect(provider: ApiKeyProvider): Promise<{ disconnected: boolean; provider: ApiKeyProvider }> {
    return fetchJson(`/integrations/external/${provider}/disconnect`, { method: 'POST' });
  },
};

// ─── Provider metadata pour le rendering UI ─────────────────────────────────

export interface ProviderMeta {
  id: ApiKeyProvider;
  label: string;
  /** Description courte affichee sous le titre dans la carte. */
  description: string;
  /** Couleur de la "brand tile" en hex (sans #). */
  brandColor: string;
  /** Texte de 2-4 lettres affiche dans la tile (ex 'YS', 'UNI'). */
  brandInitials: string;
  /** Si true, indique le provider est un QTSP francais certifie ANSSI. */
  qtspFrance: boolean;
  /** Label additionnel sous le titre (ex "QTSP francais — SES + AES + QES"). */
  badge?: string;
  /** Libelle pour le champ accountIdentifier (varie selon le provider). */
  accountIdentifierLabel?: string;
  /** Placeholder pour le champ serverUrl. */
  serverUrlPlaceholder: string;
  /** URL doc pour generer l'API key. */
  apiKeyHelpUrl?: string;
}

export const PROVIDER_META: Record<ApiKeyProvider, ProviderMeta> = {
  YOUSIGN: {
    id: 'YOUSIGN',
    label: 'Yousign',
    description:
      'QTSP français basé à Caen, certifié ANSSI. Signature électronique SES, AES et QES (équivalent juridique de la signature manuscrite).',
    brandColor: '#1F2A37',
    brandInitials: 'YS',
    qtspFrance: true,
    badge: 'QTSP français · SES + AES + QES',
    accountIdentifierLabel: 'Identifiant de compte (optionnel)',
    serverUrlPlaceholder: 'https://api.yousign.app',
    apiKeyHelpUrl: 'https://developers.yousign.com/docs/authentication',
  },
  UNIVERSIGN: {
    id: 'UNIVERSIGN',
    label: 'Universign',
    description:
      'QTSP français (Quadient), fortement implanté dans le secteur bancaire et assurance. SES, AES, QES.',
    brandColor: '#0046AD',
    brandInitials: 'UNI',
    qtspFrance: true,
    badge: 'QTSP français · SES + AES + QES',
    accountIdentifierLabel: 'Profile ID (optionnel)',
    serverUrlPlaceholder: 'https://ws.universign.eu',
    apiKeyHelpUrl: 'https://help.universign.com/',
  },
  DOCAPOSTE: {
    id: 'DOCAPOSTE',
    label: 'DocaPoste',
    description:
      'Filiale du Groupe La Poste, QTSP français. SES, AES, QES + lettre recommandée électronique (utile pour mises en demeure).',
    brandColor: '#FFCC00',
    brandInitials: 'DP',
    qtspFrance: true,
    badge: 'QTSP français · SES + AES + QES + LRE',
    accountIdentifierLabel: 'Tenant / Espace client',
    serverUrlPlaceholder: 'https://api.docaposte.fr',
    apiKeyHelpUrl: 'https://www.docaposte.com/api',
  },
  ODOO: {
    id: 'ODOO',
    label: 'Odoo',
    description:
      'Connectez votre instance Odoo (SaaS ou self-hosted). Signature via le module Sign d\'Odoo Enterprise.',
    brandColor: '#714B67',
    brandInitials: 'ODOO',
    qtspFrance: false,
    badge: 'ERP polyvalent · signature + comptabilité',
    accountIdentifierLabel: 'Nom de base + Login',
    serverUrlPlaceholder: 'https://mycompany.odoo.com',
  },
};
