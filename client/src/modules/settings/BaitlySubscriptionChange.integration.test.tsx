import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlySubscriptionChange from './BaitlySubscriptionChange';
import type { MonthlyContract } from '../../../../shared/src/types/baitlySubscription';

const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
afterEach(() => { cleanup(); expect(http.unexpected).toEqual([]); });
const contract: MonthlyContract = { id: 7, requestId: 'original', plan: 'essential', status: 'ACTIVE', currency: 'EUR', properties: 1, firstInvoiceExcludingTaxCents: 2900, monthOneCents: 2900, monthFourCents: 2610, monthSevenCents: 2320, monthThirteenCents: 2030, promoCode: null, paidUntil: '2027-01-01', cancelAtPeriodEnd: false };
const terms = { plan: 'pro', properties: 2, currency: 'EUR', subscriptionMonth: 5, effectiveAt: 1800000000, monthOne: 9800, monthFour: 8820, monthSeven: 7840, monthThirteen: 6860, version: 'price1' };
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlySubscriptionChange contract={contract} /></QueryClientProvider>); }

it('prévisualise le prix serveur et reprend la même intention après une réponse perdue', async () => {
  const bodies: Record<string, unknown>[] = [];
  http.route((req, res) => {
    if (req.method === 'GET' && req.path.includes('change-proposal')) return json(res, { terms, chargeNowCents: 0, reason: 'NEXT_RENEWAL_NO_PRORATION' });
    if (req.method === 'GET') return json(res, []);
    bodies.push(JSON.parse(req.body));return json(res, { message: 'Réponse perdue' }, 503);
  });
  open();fireEvent.change(await screen.findByLabelText('Formule'), { target: { value: 'pro' } });
  fireEvent.click(screen.getByRole('button', { name: 'Voir le tarif à la prochaine échéance' }));
  expect(await screen.findByText(/88,20/)).toBeVisible();expect(screen.getByText(/Aucun débit immédiat/)).toBeVisible();
  const confirm = screen.getByRole('button', { name: 'Confirmer ce changement' });
  fireEvent.click(confirm);fireEvent.click(confirm);
  await screen.findByRole('alert');expect(bodies).toHaveLength(1);
  fireEvent.click(confirm);await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[0]).toEqual(bodies[1]);expect(bodies[0]).toMatchObject({ plan: 'pro', accepted: terms });
});

it('reprend une demande persistée après rechargement sans permettre un deuxième changement', async () => {
  let sent: Record<string, unknown> | null = null;
  http.route((req, res) => {
    if (req.method === 'POST') { sent = JSON.parse(req.body);return json(res, { id: 10, requestId: 'saved', terms, status: 'SCHEDULED' }); }
    return json(res, [{ id: 10, requestId: 'saved', terms, status: sent ? 'SCHEDULED' : 'PREPARED' }]);
  });
  open();fireEvent.click(await screen.findByRole('button', { name: /Reprendre/ }));
  await waitFor(() => expect(sent).toEqual({ plan: 'pro', requestId: 'saved', accepted: terms }));
  expect(await screen.findByRole('status')).toHaveTextContent('Changement programmé');
  expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByRole('button', { name: /Confirmer/ })).toBeNull();
});

it('refuse un portail de paiement hors de Stripe', async () => {
  http.route((req, res) => json(res, req.method === 'POST' ? { url: 'https://billing.stripe.com.attacker.invalid/' } : []));
  open();fireEvent.click(screen.getByRole('button', { name: 'Moyen de paiement' }));
  expect(await screen.findByRole('alert')).toBeVisible();
});
