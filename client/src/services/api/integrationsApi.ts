/**
 * Client API pour la configuration cross-provider des integrations.
 *
 * Stocke le choix radio du provider (Pennylane / Odoo / aucun) par type de
 * service (signature, et plus tard accounting, invoicing, etc.).
 *
 * Endpoints backend :
 *   - GET /api/integrations/config             → config actuelle de l'org
 *   - PUT /api/integrations/signature-provider → set le provider signature
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export type SignatureProvider =
  | 'PENNYLANE'
  | 'DOCUSIGN'
  | 'ODOO'
  | 'YOUSIGN'
  | 'UNIVERSIGN'
  | 'DOCAPOSTE'
  | 'DOCUSEAL'
  | 'CLENZY_CUSTOM'
  | null;

export interface IntegrationsConfig {
  signatureProvider: SignatureProvider;
}

/** État d'un provider de signature côté backend (registre + disponibilité). */
export interface SignatureProviderState {
  type: Exclude<SignatureProvider, null>;
  /** Configuré/connecté : prêt à être utilisé si activé via SIGNATURE_PROVIDER. */
  available: boolean;
  /** Provider effectivement actif (SIGNATURE_PROVIDER). */
  active: boolean;
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

export const integrationsApi = {
  async getConfig(): Promise<IntegrationsConfig> {
    return fetchJson('/integrations/config');
  },

  async setSignatureProvider(provider: SignatureProvider): Promise<IntegrationsConfig> {
    return fetchJson('/integrations/signature-provider', {
      method: 'PUT',
      body: JSON.stringify({ provider }),
    });
  },

  /** État des providers de signature enregistrés (disponibilité + provider actif). */
  async getSignatureProviders(): Promise<SignatureProviderState[]> {
    return fetchJson('/integrations/external/signature-providers');
  },
};
