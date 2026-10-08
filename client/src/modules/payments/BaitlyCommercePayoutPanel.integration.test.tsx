vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'test:2' }));
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyCommercePayoutPanel from './BaitlyCommercePayoutPanel';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
const initial = { currency: 'EUR', ownerAvailable: 72, conciergeAvailable: 0, transfers: [], recoveries: [] };
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlyCommercePayoutPanel source="UPSELL" sourceId={8} /></QueryClientProvider>); }
it('montre le montant avant émission et conserve la même demande après une réponse perdue', async () => {
  const sent: unknown[] = [];http.route((req, res) => { if (req.method === 'GET') return json(res, initial);sent.push(JSON.parse(req.body));return json(res, { message: 'Résultat à vérifier' }, 503); });
  open();fireEvent.click(await screen.findByRole('button', { name: 'Préparer le versement' }));
  expect(screen.getByText(/Verser 72/)).toBeVisible();expect(sent).toHaveLength(0);
  const pay = screen.getByRole('button', { name: 'Confirmer le versement' });fireEvent.click(pay);fireEvent.click(pay);await screen.findByRole('alert');expect(sent).toHaveLength(1);
  await waitFor(() => expect(pay).toBeEnabled());fireEvent.click(pay);await waitFor(() => expect(sent).toHaveLength(2));expect(sent[0]).toEqual(sent[1]);
});
it('rend les récupérations en cours sans autoriser de nouvelle émission', async () => {
  http.route((req, res) => json(res, { ...initial, recoveries: [{ id: 9, amount: 24, state: 'REVIEW_REQUIRED' }] }));
  open();expect(await screen.findByText(/Récupération à vérifier/)).toBeVisible();expect(screen.getByRole('button', { name: 'Préparer le versement' })).toBeDisabled();
});
it('annule uniquement la préparation sans journal et recharge son solde', async () => {
  let cancelled = false;
  http.route((req, res) => {
    if (req.method === 'POST') { expect(req.path).toBe('/api/commerce/payouts/7/cancel');cancelled = true;return json(res, {}); }
    return json(res, { ...initial, ownerAvailable: cancelled ? 72 : 0, transfers: [{ id: 7, requestId: 'request', party: 'OWNER', amount: 72, state: cancelled ? 'CANCELLED' : 'PREPARED' }] });
  });
  open();fireEvent.click(await screen.findByRole('button', { name: 'Annuler la préparation' }));
  expect(await screen.findByText(/Préparation annulée/)).toBeVisible();expect(screen.getByRole('button', { name: 'Préparer le versement' })).toBeEnabled();
});
