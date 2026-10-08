import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyHardwareInventoryPanel from './BaitlyHardwareInventoryPanel';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
it('ne crée aucun stock à la lecture et exige une preuve pour la réception', async () => {
  let posted: unknown = null;http.route((req, res) => { if (req.method === 'GET') return json(res, []);posted = JSON.parse(req.body);return json(res, {}); });
  render(<QueryClientProvider client={new QueryClient()}><BaitlyHardwareInventoryPanel /></QueryClientProvider>);
  await screen.findByText('0 disponibles · 0 réservés');expect(posted).toBeNull();
  fireEvent.change(screen.getByLabelText('Quantité à ajouter ou retirer'), { target: { value: '2' } });expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Bon de réception ou motif justifié'), { target: { value: 'BON-1' } });fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() => expect(posted).toMatchObject({ country: 'FR', expected: 0, delta: 2, proof: 'BON-1', requestId: expect.any(String) }));
});
