import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../keycloak', () => ({ default: {}, getAccessToken: () => undefined }));
vi.mock('../../config/api', () => ({ API_CONFIG: { BASE_URL: 'http://localhost', BASE_PATH: '/api' } }));
import { invoicesApi } from '../api/invoicesApi';

afterEach(() => vi.unstubAllGlobals());
it.each([false, true])('downloads original and credit note bytes without text corruption, refresh=%s', async refresh => {
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 255, 0, 128, 254]);
  const call = vi.fn();
  if (refresh) call.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  call.mockResolvedValueOnce(new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } }));
  vi.stubGlobal('fetch', call);
  const blob = await invoicesApi.downloadPdf(42);
  expect(blob.type).toBe('application/pdf');
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  expect(call).toHaveBeenLastCalledWith('http://localhost/api/invoices/42/pdf', expect.objectContaining({ credentials: 'include' }));
});
it('keeps PDF authorization failures as errors, never as a downloadable file', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Facture introuvable' }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  })));
  await expect(invoicesApi.downloadPdf(42)).rejects.toMatchObject({ status: 403, message: 'Facture introuvable' });
});
