import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const report = vi.hoisted(() => vi.fn());
vi.mock('../baitlySentry', () => ({ reportBaitlyApiFailure: report }));
vi.mock('../../keycloak', () => ({ default: {}, getAccessToken: () => 'private-token' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { BASE_URL: 'http://localhost', BASE_PATH: '/api' } }));
import apiClient from '../apiClient';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('API failure detection without changing results', () => {
  it('reports 503 without the request body, authorization or response body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'PRIVATE guest details' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'afae05bd-c110-48a4-a062-9f5320e410c0' } })));
    await expect(apiClient.post('/payments/42', { iban: 'PRIVATE' }))
      .rejects.toMatchObject({ status: 503, message: 'PRIVATE guest details' });
    expect(report).toHaveBeenCalledWith('POST', '/payments/42', 503, 'afae05bd-c110-48a4-a062-9f5320e410c0');
    expect(JSON.stringify(report.mock.calls)).not.toContain('PRIVATE');
    expect(JSON.stringify(report.mock.calls)).not.toContain('private-token');
  });

  it('reports a network failure without forwarding its arbitrary message', async () => {
    const error = new TypeError('PRIVATE token in transport error');
    vi.stubGlobal('fetch', vi.fn(async () => { throw error; }));
    await expect(apiClient.get('/reservations')).rejects.toBe(error);
    expect(report).toHaveBeenCalledWith('GET', '/reservations', 0);
    expect(JSON.stringify(report.mock.calls)).not.toContain('PRIVATE');
  });

  it('does not flag intentional cancellation as a network incident', async () => {
    const controller = new AbortController(); controller.abort();
    const error = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal('fetch', vi.fn(async () => { throw error; }));
    await expect(apiClient.get('/reservations', { signal: controller.signal })).rejects.toBe(error);
    expect(report).not.toHaveBeenCalled();
  });
});
