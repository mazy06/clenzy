import { API_CONFIG } from '../config/api';
import keycloak, { getAccessToken } from '../keycloak';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

// ─── Token Refresh Mutex ────────────────────────────────────────────────────
// Prevents multiple concurrent refresh attempts when several 401s arrive
// at the same time. All callers wait on the same promise.

let refreshPromise: Promise<boolean> | null = null;

/**
 * Renouvelle la session (mutex partage). Deux chemins complementaires :
 *  1. `keycloak.refreshToken` present (login recent, meme onglet, sans reload)
 *     → refresh JS classique via `updateToken`.
 *  2. Sinon — mode degrade apres un hard refresh, quand le token JS a disparu
 *     de la memoire (cf. keycloak.ts) — → refresh COTE SERVEUR via le cookie
 *     HttpOnly `clenzy_refresh` (POST /api/auth/session/refresh). C'est ce
 *     second chemin qui corrige les deconnexions au rechargement : avant, sans
 *     `keycloak.refreshToken`, tout refresh etait abandonne.
 *
 * Exporte pour le refresh PROACTIF (cf. keycloak.ts) en plus de l'intercepteur 401.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // Chemin 1 : refresh token encore en memoire JS
      if (keycloak.authenticated && keycloak.refreshToken) {
        try {
          await keycloak.updateToken(60);
          if (keycloak.token) {
            await syncTokenCookie(keycloak.token, keycloak.refreshToken);
            return true;
          }
        } catch {
          // updateToken a echoue (refresh token expire cote Keycloak) :
          // on tente quand meme le cookie serveur ci-dessous.
        }
      }
      // Chemin 2 : refresh cote serveur via le cookie HttpOnly clenzy_refresh
      return await backendRefresh();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Renouvelle la session cote serveur depuis le cookie HttpOnly clenzy_refresh.
 * Aucun token ne transite en JS. En cas de succes, on met a jour l'`exp` du
 * `tokenParsed` Keycloak (mode degrade) pour que le refresh proactif se re-arme
 * sur la nouvelle expiration plutot que sur l'ancienne (sinon : boucle serree).
 */
async function backendRefresh(): Promise<boolean> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/auth/session/refresh`;
    const resp = await fetch(url, { method: 'POST', credentials: 'include' });
    if (!resp.ok) return false;
    const data = (await resp.json().catch(() => null)) as { expiresAt?: number } | null;
    if (data?.expiresAt && keycloak.tokenParsed) {
      keycloak.tokenParsed.exp = data.expiresAt;
    }
    return true;
  } catch {
    return false;
  }
}

/** Alias historique conserve pour l'intercepteur 401 ci-dessous. */
function refreshTokenOnce(): Promise<boolean> {
  return refreshSession();
}

// ─── HttpOnly Cookie Sync ───────────────────────────────────────────────────

/**
 * Syncs the JWT to a server-side HttpOnly cookie.
 * Called after login and after each token refresh.
 * The server sets Set-Cookie: clenzy_auth=<token>; HttpOnly; Secure; SameSite=Strict.
 *
 * Quand `refreshToken` est fourni (typiquement au login / apres un updateToken),
 * il est transmis UNE fois via le header `X-Refresh-Token` pour que le backend
 * le stocke dans le cookie HttpOnly `clenzy_refresh`. Ce cookie permet ensuite
 * de renouveler la session cote serveur (POST /api/auth/session/refresh), y
 * compris apres un hard refresh ou un echec de check-sso — sans jamais exposer
 * le refresh token au JS au-dela de ce transfert initial.
 */
export async function syncTokenCookie(token: string, refreshToken?: string): Promise<void> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/auth/session`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (refreshToken) {
      headers['X-Refresh-Token'] = refreshToken;
    }
    await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include', // Accept the Set-Cookie from server
    });
  } catch {
    // Silent — cookie sync is best-effort during migration
  }
}

/**
 * Clears the HttpOnly cookie on logout.
 */
export async function clearTokenCookie(): Promise<void> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/auth/session`;
    await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // Silent
  }
}

// ─── Query String Builder ────────────────────────────────────────────────────

function buildQueryString(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const filtered = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return filtered.length > 0 ? `?${filtered.join('&')}` : '';
}

// ─── Response Handler ────────────────────────────────────────────────────────

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Erreur ${response.status}`;
    let details: unknown;

    try {
      const errorBody = await response.json();
      message = errorBody.message || errorBody.error || message;
      details = errorBody;
    } catch {
      try {
        message = await response.text();
      } catch {
        // Use default message
      }
    }

    const error: ApiError = { status: response.status, message, details };
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Try to parse JSON, fallback to text
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text() as T;
}

// ─── Core Request Function ───────────────────────────────────────────────────

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}${buildQueryString(options.params)}`;

  const headers: Record<string, string> = {
    ...options.headers,
  };

  // Add auth token unless explicitly skipped.
  // During migration: send both the Authorization header AND credentials: 'include' (cookie).
  // The backend accepts either. Once migration is complete, the header can be removed.
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Set Content-Type for JSON bodies (not for FormData)
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
    signal: options.signal,
    credentials: 'include', // Send HttpOnly cookie on every request
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, config);

  // 401 Interceptor: refresh token and retry once
  if (response.status === 401 && !options.skipAuth) {
    const refreshed = await refreshTokenOnce();
    if (refreshed) {
      // Rebuild headers with fresh token
      const freshToken = getAccessToken();
      if (freshToken) {
        headers['Authorization'] = `Bearer ${freshToken}`;
      }
      const retryConfig: RequestInit = {
        method,
        headers,
        signal: options.signal,
        credentials: 'include',
      };
      if (body) {
        retryConfig.body = body instanceof FormData ? body : JSON.stringify(body);
      }
      const retryResponse = await fetch(url, retryConfig);
      return handleResponse<T>(retryResponse);
    }
  }

  return handleResponse<T>(response);
}

// ─── Public API Methods ──────────────────────────────────────────────────────

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', endpoint, undefined, options);
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', endpoint, body, options);
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', endpoint, body, options);
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', endpoint, body, options);
  },

  delete<T = void>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', endpoint, undefined, options);
  },

  /**
   * Upload files via FormData
   */
  upload<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>('POST', endpoint, formData, options);
  },
};

export default apiClient;
