import type { BookingError } from './types';

/**
 * Minimal HTTP client wrapping fetch().
 * Adds API Key header and timeout support.
 * ~400 bytes minified.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(baseUrl: string, apiKey: string, timeout: number) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Booking-Key': this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const error: BookingError = {
          message: (errorBody as Record<string, string>).error || `HTTP ${response.status}`,
          status: response.status,
          code: response.status === 429 ? 'RATE_LIMITED' : 'API_ERROR',
        };
        throw error;
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err && typeof err === 'object' && 'message' in err && 'status' in err) {
        throw err; // Already a BookingError
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          code: 'TIMEOUT',
        } satisfies BookingError;
      }

      throw {
        message: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
      } satisfies BookingError;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
