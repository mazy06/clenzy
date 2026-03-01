/**
 * API Client - adapted from client/src/services/apiClient.ts
 * Key differences: reads token from SecureStore, adds offline detection + retry
 */
import { API_CONFIG } from '@/config/api';
import { useAuthStore } from '@/store/authStore';

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
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

function buildQueryString(params?: RequestOptions['params']): string {
  if (!params) return '';
  const filtered = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return filtered.length > 0 ? `?${filtered.join('&')}` : '';
}

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

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text() as T;
}

function isTokenExpiringSoon(token: string, thresholdSeconds: number): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now < thresholdSeconds;
  } catch {
    return true;
  }
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}${buildQueryString(options.params)}`;

  const headers: Record<string, string> = { ...options.headers };

  if (!options.skipAuth) {
    const authState = useAuthStore.getState();
    let token = authState.accessToken;

    // Pre-emptive refresh if expiring soon (60s threshold)
    if (token && isTokenExpiringSoon(token, 60)) {
      const refreshed = await authState.refreshAccessToken();
      if (refreshed) {
        token = useAuthStore.getState().accessToken;
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
    signal: options.signal,
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, config);

  // Handle 401 with token refresh retry
  if (response.status === 401 && !options.skipAuth) {
    const authState = useAuthStore.getState();
    const refreshed = await authState.refreshAccessToken();
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken;
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(url, { ...config, headers });
      return handleResponse<T>(retryResponse);
    } else {
      authState.logout();
      throw { status: 401, message: 'Session expiree' } as ApiError;
    }
  }

  return handleResponse<T>(response);
}

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

  upload<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>('POST', endpoint, formData, options);
  },
};
