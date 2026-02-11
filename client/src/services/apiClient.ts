import { API_CONFIG } from '../config/api';
import { getAccessToken } from './storageService';

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

// ─── Token Access ────────────────────────────────────────────────────────────

function getAuthToken(): string | null {
  return getAccessToken();
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

  // Add auth token unless explicitly skipped
  if (!options.skipAuth) {
    const token = getAuthToken();
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
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, config);
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
