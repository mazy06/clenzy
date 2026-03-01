// Mock fetch globally
const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

// Mock authStore
jest.mock('@/store/authStore', () => {
  const store = {
    accessToken: 'valid-token',
    refreshToken: 'refresh-token',
    refreshAccessToken: jest.fn().mockResolvedValue(true),
    logout: jest.fn(),
  };
  return {
    useAuthStore: {
      getState: () => store,
      setState: (partial: Record<string, unknown>) => Object.assign(store, partial),
    },
  };
});

import { useAuthStore } from '@/store/authStore';

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  // Reset token
  (useAuthStore as unknown as { setState: (p: Record<string, unknown>) => void }).setState({
    accessToken: 'valid-token',
  });
});

function mockJsonResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => h === 'content-type' ? 'application/json' : null },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe('apiClient', () => {
  describe('GET', () => {
    it('should make GET request with auth header', async () => {
      mockJsonResponse({ id: 1, name: 'test' });

      const { apiClient } = require('../apiClient');
      const result = await apiClient.get('/interventions/1');

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/interventions/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        }),
      );
    });

    it('should append query params', async () => {
      mockJsonResponse({ content: [] });

      const { apiClient } = require('../apiClient');
      await apiClient.get('/interventions', { params: { page: 0, size: 10 } });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('page=0');
      expect(calledUrl).toContain('size=10');
    });

    it('should skip undefined/null params', async () => {
      mockJsonResponse({ content: [] });

      const { apiClient } = require('../apiClient');
      await apiClient.get('/interventions', { params: { page: 0, status: undefined, name: null } });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('page=0');
      expect(calledUrl).not.toContain('status');
      expect(calledUrl).not.toContain('name');
    });
  });

  describe('POST', () => {
    it('should make POST request with JSON body', async () => {
      mockJsonResponse({ id: 1 }, 201);
      // Need to also mock as ok=true for 201
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: (h: string) => h === 'content-type' ? 'application/json' : null },
        json: () => Promise.resolve({ id: 1 }),
      });

      const { apiClient } = require('../apiClient');
      const result = await apiClient.post('/interventions', { name: 'New' });

      expect(result).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/interventions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('DELETE', () => {
    it('should handle 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
      });

      const { apiClient } = require('../apiClient');
      const result = await apiClient.delete('/interventions/1');

      expect(result).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ message: 'Not found' }),
      });

      const { apiClient } = require('../apiClient');
      await expect(apiClient.get('/missing')).rejects.toMatchObject({
        status: 404,
        message: 'Not found',
      });
    });

    it('should skip auth header when skipAuth is true', async () => {
      mockJsonResponse({ status: 'ok' });

      const { apiClient } = require('../apiClient');
      await apiClient.get('/health', { skipAuth: true });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });
});
