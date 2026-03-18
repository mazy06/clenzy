import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PennylaneStatus {
  connected: boolean;
  connectedAt?: string;
  lastSyncAt?: string;
  scopes?: string;
  status?: string;
}

export interface PennylaneSyncResult {
  type: string;
  synced: number;
  failed: number;
  total: number;
  errors: string[];
}

export interface PennylaneSyncStatus {
  pendingInvoices: number;
  pendingExpenses: number;
  lastSyncAt?: string;
  connected: boolean;
}

export interface PennylaneSyncAllResult {
  invoices: PennylaneSyncResult;
  expenses: PennylaneSyncResult;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    throw new Error(`Erreur ${response.status}`);
  }

  // 204 No Content — pas de body a parser
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return response.json();
}

// ─── API ────────────────────────────────────────────────────────────────────

export const pennylaneApi = {
  // --- OAuth ---

  /** Lance la connexion OAuth — retourne l'URL d'autorisation Pennylane */
  async connect(): Promise<{ authorization_url: string; status: string }> {
    return fetchJson('/pennylane/connect');
  },

  /** Deconnecte Pennylane (revoque le token) */
  async disconnect(): Promise<void> {
    await fetchJson<void>('/pennylane/disconnect', { method: 'POST' });
  },

  /** Retourne le statut de connexion Pennylane */
  async getStatus(): Promise<PennylaneStatus> {
    return fetchJson('/pennylane/status');
  },

  // --- Sync ---

  /** Synchronise toutes les factures en attente vers Pennylane */
  async syncInvoices(): Promise<PennylaneSyncResult> {
    return fetchJson('/pennylane/accounting/sync-invoices', { method: 'POST' });
  },

  /** Synchronise toutes les depenses en attente vers Pennylane */
  async syncExpenses(): Promise<PennylaneSyncResult> {
    return fetchJson('/pennylane/accounting/sync-expenses', { method: 'POST' });
  },

  /** Synchronise tout (factures + depenses) vers Pennylane */
  async syncAll(): Promise<PennylaneSyncAllResult> {
    return fetchJson('/pennylane/accounting/sync-all', { method: 'POST' });
  },

  /** Retourne le statut de synchronisation (elements en attente, derniere sync) */
  async getSyncStatus(): Promise<PennylaneSyncStatus> {
    return fetchJson('/pennylane/accounting/sync-status');
  },
};
