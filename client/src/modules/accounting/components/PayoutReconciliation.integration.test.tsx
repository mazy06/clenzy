import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../../tests/fixtures/baitlyFinanceHttp';
import { ReconciliationForm } from './PayoutTrackingTab';
import type { PayoutTransfer } from '../../../services/api/payoutTransfersApi';

const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();
const clients: QueryClient[] = [];
const transfer: PayoutTransfer = { id: 21, source: 'INTERVENTION', sourceId: 11, beneficiaryUserId: null,
  beneficiaryOrganizationId: 9, amount: 80, currency: 'EUR', provider: 'STRIPE', state: 'RECONCILIATION_REQUIRED',
  externalReference: null, description: 'Maintenance', createdAt: '2026-10-05T08:00:00Z', updatedAt: '2026-10-05T08:00:00Z' };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const updated = vi.fn();
  render(<QueryClientProvider client={client}><ReconciliationForm transfer={transfer} onUpdated={updated} /></QueryClientProvider>);
  return updated;
}
async function verify() {
  fireEvent.change(screen.getByLabelText('Référence Stripe'), { target: { value: 'tr_contract' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier la référence' }));
  await screen.findByText('Référence et dossier concordants');
}
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); expect(http.unexpected).toEqual([]); });

it('envoie la référence vérifiée, exige le consentement puis confirme sans endpoint de transfert', async () => {
  let release!: () => void;
  http.route(async (request, response) => {
    expect(request.method).toBe('POST'); expect(JSON.parse(request.body)).toEqual({ reference: 'tr_contract' });
    if (request.path === '/api/accounting/payout-transfers/21/reconciliation/verify') {
      return json(response, { reference: 'tr_contract', destination: 'acct_company', livemode: false, createdAt: transfer.createdAt });
    }
    if (request.path === '/api/accounting/payout-transfers/21/reconciliation/confirm') {
      await new Promise<void>(resolve => { release = resolve; });
      return json(response, { ...transfer, state: 'TRANSFERRED', externalReference: 'tr_contract' });
    }
    throw new Error('Un rapprochement ne doit jamais émettre un nouveau transfert');
  });
  const updated = mount(); await verify();
  expect(screen.getByText(/Mode test/)).toBeVisible();
  const button = screen.getByRole('button', { name: 'Confirmer le rapprochement' });
  expect(button).toBeDisabled(); expect(http.requests).toHaveLength(1);
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(http.requests).toHaveLength(2));
  expect(button).toBeDisabled(); release();
  expect(await screen.findByText('Rapprochement enregistré.')).toBeVisible();
  expect(updated).toHaveBeenCalledOnce(); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('un refus HTTP lors de la confirmation invalide la preuve et ne réémet aucune mutation', async () => {
  http.route((request, response) => {
    if (request.path.endsWith('/verify')) return json(response,
      { reference: 'tr_contract', destination: 'acct_company', livemode: false, createdAt: transfer.createdAt });
    if (request.path.endsWith('/confirm')) return json(response, { message: 'Le dossier a changé.' }, 409);
    throw new Error('Route inattendue');
  });
  const updated = mount(); await verify();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rapprochement' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByText('Rapprochement enregistré.')).not.toBeInTheDocument();
  expect(updated).toHaveBeenCalledOnce();
  expect(http.requests.filter(r => r.path.endsWith('/confirm'))).toHaveLength(1);
});

it('changer la référence retire le consentement sans envoyer l’ancienne référence', async () => {
  http.route((request, response) => {
    if (!request.path.endsWith('/verify')) throw new Error('Aucune confirmation autorisée');
    json(response, { reference: 'tr_contract', destination: 'acct_company', livemode: false, createdAt: transfer.createdAt });
  });
  mount(); await verify(); fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Référence Stripe'), { target: { value: 'tr_changed' } });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirmer le rapprochement' })).not.toBeInTheDocument();
  expect(http.requests).toHaveLength(1);
});
