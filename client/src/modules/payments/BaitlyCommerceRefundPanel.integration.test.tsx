vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'test:2' }));
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyCommerceRefundPanel from './BaitlyCommerceRefundPanel';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
const initial = { reference: 'TX-upsell', source: 'UPSELL', sourceId: 8, currency: 'EUR', paid: 100, refunded: 0, reserved: 0, available: 100, refunds: [] };
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlyCommerceRefundPanel source="UPSELL" sourceId={8} /></QueryClientProvider>); }
it('conserve la même décision après une réponse perdue et protège contre le double clic', async () => {
  const sent: unknown[] = [];
  http.route((req, res) => { if (req.method === 'GET') return json(res, initial);sent.push(JSON.parse(req.body));return json(res, { message: 'Réponse perdue' }, 503); });
  open();fireEvent.change(await screen.findByLabelText('Montant (EUR)'), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Service annulé' } });
  const confirm = screen.getByRole('button', { name: /Confirmer le remboursement de/ });
  fireEvent.click(confirm);fireEvent.click(confirm);await screen.findByRole('alert');expect(sent).toHaveLength(1);
  fireEvent.click(confirm);await waitFor(() => expect(sent).toHaveLength(2));expect(sent[0]).toEqual(sent[1]);
  expect(sent[0]).toMatchObject({ reference: 'TX-upsell', amount: 30, reason: 'Service annulé', requestId: expect.any(String) });
});
it('affiche une restitution en cours sans autoriser une seconde émission', async () => {
  http.route((req, res) => json(res, { ...initial, reserved: 30, available: 70, refunds: [{ reference: 'REF-1', amount: 30, status: 'PROCESSING', applied: false, reason: 'Service annulé' }] }));
  open();expect(await screen.findByText(/Vérification en cours/)).toBeVisible();expect(screen.queryByLabelText('Montant (EUR)')).toBeNull();
});
it('refuse localement un montant au-delà du solde serveur', async () => {
  http.route((req, res) => json(res, { ...initial, refunded: 90, available: 10 }));
  open();fireEvent.change(await screen.findByLabelText('Montant (EUR)'), { target: { value: '11' } });
  fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Solde' } });expect(screen.getByRole('button', { name: /Confirmer le remboursement/ })).toBeDisabled();
});
