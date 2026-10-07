import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../keycloak', () => ({ default: {}, getAccessToken: () => undefined }));
vi.mock('../../config/api', () => ({ API_CONFIG: { BASE_URL: 'http://localhost', BASE_PATH: '/api' } }));
import apiClient from '../apiClient';

describe('apiClient error messages', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    ['Cette intervention est annulée', 'text/plain', 'Cette intervention est annulée'],
    [JSON.stringify({ message: 'Montant incorrect' }), 'application/json', 'Montant incorrect'],
    [JSON.stringify('Paiement indisponible'), 'application/json', 'Paiement indisponible'],
    ['', 'text/plain', 'Erreur 400'],
  ])('keeps the useful server error: %s', async (body, contentType, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 400, headers: { 'Content-Type': contentType } })));
    await expect(apiClient.post('/payments/create-embedded-session', {})).rejects.toMatchObject({ status: 400, message: expected });
  });
});
