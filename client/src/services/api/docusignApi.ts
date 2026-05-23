/**
 * Client API DocuSign — symetrique a {@link pennylaneApi.ts}.
 *
 * <p>Cote serveur, DocuSign et Pennylane partagent le moteur OAuth
 * ({@code OAuthFlowEngine}) mais chaque provider expose son propre prefix REST
 * pour la coherence avec les conventions Spring du projet (cf. routes
 * {@code /api/pennylane/*} historiques).</p>
 *
 * <p>Endpoints de signature (creer enveloppe, statut, telechargement) seront
 * ajoutes quand l'integration sera cablee — pour l'instant on n'expose que
 * le flow OAuth (connect / callback / disconnect / status).</p>
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export interface DocuSignStatus {
  connected: boolean;
  connectedAt?: string;
  scopes?: string;
  accountId?: string;
  status?: string;
  errorMessage?: string;
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

export const docusignApi = {
  /** Lance la connexion OAuth — retourne l'URL d'autorisation DocuSign. */
  async connect(): Promise<{ authorization_url?: string; status: string; message?: string }> {
    return fetchJson('/docusign/connect');
  },

  /** Deconnecte DocuSign (revoque le token cote provider, marque REVOKED en local). */
  async disconnect(): Promise<void> {
    await fetchJson<void>('/docusign/disconnect', { method: 'POST' });
  },

  /** Retourne le statut de connexion DocuSign pour l'organisation courante. */
  async getStatus(): Promise<DocuSignStatus> {
    return fetchJson('/docusign/status');
  },
};
