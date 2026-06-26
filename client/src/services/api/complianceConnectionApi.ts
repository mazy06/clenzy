/**
 * Client API pour les providers de conformite legale (declaration voyageurs).
 * Mirror de {@code pricingConnectionApi.ts} sur les routes
 * /api/integrations/compliance/*.
 *
 * Endpoints backend :
 *   - POST   /api/integrations/compliance/{provider}/connect
 *   - GET    /api/integrations/compliance/{provider}/status
 *   - POST   /api/integrations/compliance/{provider}/disconnect
 *   - GET    /api/compliance/declarations/by-reservation/{reservationId}
 *   - POST   /api/compliance/declarations/{id}/submit
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

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

/** Statut du cycle de vie d'une fiche de police (mirror DeclarationStatus côté serveur). */
export type DeclarationStatus = 'PENDING' | 'COMPLETED' | 'SUBMITTED';

/**
 * Vue SANS PII d'une fiche de police d'une réservation (statut de soumission).
 * Mirror du record serveur {@code DeclarationSummaryDto} — aucun champ d'identité.
 */
export interface DeclarationSummary {
  id: number;
  primary: boolean;
  status: DeclarationStatus;
  providerType?: string | null;
  submittedAt?: string | null;
  submittedToProvider: boolean;
}

/** Résultat d'une (re)soumission. {@code pending} = provider non intégrable (501). */
export interface DeclarationSubmitResult {
  accepted: boolean;
  message: string;
  externalReference?: string;
  skipped?: boolean;
  pending?: boolean;
  provider?: string;
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

  /** Statut (sans PII) des fiches de police d'une réservation. */
  async listReservationDeclarations(reservationId: number): Promise<DeclarationSummary[]> {
    return fetchJson(`/compliance/declarations/by-reservation/${reservationId}`);
  },

  /**
   * (Re)soumet une fiche de police au provider de conformité.
   *
   * <p>Un provider gouvernemental non intégrable répond 501 : le serveur renvoie alors
   * un corps {@code { pending: true, provider, message }} que l'on remonte tel quel
   * (intégration en attente) plutôt qu'une erreur brute.</p>
   */
  async retryDeclarationSubmission(declarationId: number): Promise<DeclarationSubmitResult> {
    try {
      return await fetchJson<DeclarationSubmitResult>(
        `/compliance/declarations/${declarationId}/submit`,
        { method: 'POST' },
      );
    } catch (err) {
      const e = err as { status?: number; body?: unknown };
      // 501 = provider non intégrable (DGSN/Absher) → corps « pending » exploitable, pas une erreur.
      if (e.status === 501 && e.body && typeof e.body === 'object') {
        return e.body as DeclarationSubmitResult;
      }
      throw err;
    }
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
