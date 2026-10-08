import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { financeHttp, json } from '../../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyExpensePayment from './BaitlyExpensePayment';
import type { ProviderExpense } from '../../../services/api/providerExpensesApi';

// Seuls l'identité et l'hôte sont substitués. Composant, React Query, API et fetch sont réels.
const context = vi.hoisted(() => ({ origin: '', staff: true, user: { id: 1, organizationId: 7 } }));
vi.mock('../../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: context.user, hasRole: () => context.staff }) }));
const http = financeHttp();
const clients: QueryClient[] = [];
const beneficiary = { userId: 42, organizationId: null, name: "Jean Martin", companyId: null, companyName: null, locked: false };
const expense = { id: 31, providerName: 'Jean Martin', amountTtc: 10, currency: 'EUR', status: 'INCLUDED' } as ProviderExpense;
function mount(row = expense) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter><BaitlyExpensePayment expense={row} /></MemoryRouter></QueryClientProvider>);
}
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
beforeEach(() => { context.staff = true; http.route(() => { throw new Error('Requête interdite'); }); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); expect(http.unexpected).toEqual([]); });

it('traverse le vrai client HTTP, confirme le bénéficiaire et ne fait qu’un POST malgré le double clic', async () => {
  let release!: () => void;
  let transferred = false;
  http.route(async (request, response) => {
    if (request.method === 'GET' && request.path === '/api/provider-expenses/31/transfer-preview') {
      return json(response, { beneficiary, eligible: !transferred, reason: transferred ? 'Transfert déjà confirmé.' : null });
    }
    if (request.method === 'POST' && request.path === '/api/provider-expenses/31/transfer') {
      expect(JSON.parse(request.body)).toEqual({ userId: 42, organizationId: null }); // Confirmation comparée au bénéficiaire relu côté serveur.
      await new Promise<void>(resolve => { release = resolve; });
      transferred = true;
      return json(response, { state: 'TRANSFERRED', externalReference: 'tr_contract_test' });
    }
    throw new Error('Route inattendue');
  });
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: /Préparer le versement/ }));
  expect(screen.getByText(/compte personnel de Jean Martin/)).toHaveTextContent('10,00');
  expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(0);
  const button = screen.getByRole('button', { name: /Verser 10/ });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1));
  expect(button).toBeDisabled(); release();
  expect(await screen.findByRole('status')).toHaveTextContent('tr_contract_test');
  expect(screen.getByRole('status')).toHaveTextContent('réception bancaire se consulte');
  view.unmount(); mount({ ...expense, status: 'PAID', paymentReference: 'tr_contract_test' });
  expect(screen.queryByRole('button', { name: /Préparer|Verser/ })).not.toBeInTheDocument();
  expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1);
});

it.each(['json', 'texte'])('affiche le refus métier HTTP %s et bloque une émission lorsque la relecture échoue', async format => {
  let posts = 0;
  const reason = 'Transfert à rapprocher : aucun nouvel envoi autorisé.';
  http.route((request, response) => {
    if (request.method === 'GET' && request.path.endsWith('/transfer-preview')) {
      return posts ? json(response, { message: 'Surveillance indisponible' }, 503) : json(response, { eligible: true, beneficiary });
    }
    if (request.method === 'POST' && request.path === '/api/provider-expenses/31/transfer') {
      posts++;
      if (format === 'json') return json(response, { message: reason }, 409);
      response.writeHead(409, { 'content-type': 'text/plain' }); response.end(reason); return;
    }
    throw new Error('Route inattendue');
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: /Préparer le versement/ }));
  fireEvent.click(screen.getByRole('button', { name: /Verser 10/ }));
  expect(await screen.findByText(reason)).toBeVisible();
  await waitFor(() => expect(screen.getByRole('button', { name: /Verser 10/ })).toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: /Verser 10/ }));
  expect(posts).toBe(1);
});

it('ne fait aucun appel réseau pour une dépense seulement approuvée ou un prestataire', () => {
  const view = mount({ ...expense, status: 'APPROVED' });
  expect(screen.getByText(/sera déduite/)).toBeVisible(); view.unmount();
  context.staff = false; mount();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(http.requests).toEqual([]);
});

it('désigne la société sans envoyer d’argent puis confirme son identité dans le vrai POST de versement', async () => {
  let selected = false;
  http.route((request, response) => {
    if (request.method === 'GET' && request.path.endsWith('/transfer-preview')) {
      return json(response, { eligible: true, reason: null, beneficiary: { ...beneficiary,
        companyId: 9, companyName: 'Société Azur', userId: selected ? null : 42,
        organizationId: selected ? 9 : null, name: selected ? 'Société Azur' : 'Jean Martin', locked: selected } });
    }
    if (request.method === 'PUT' && request.path.endsWith('/beneficiary')) {
      expect(JSON.parse(request.body)).toEqual({ organizationId: 9 }); selected = true;
      return json(response, { ...beneficiary, userId: null, organizationId: 9, locked: true });
    }
    if (request.method === 'POST' && request.path.endsWith('/transfer')) {
      expect(selected).toBe(true);
      expect(JSON.parse(request.body)).toEqual({ userId: null, organizationId: 9 });
      return json(response, { state: 'TRANSFERRED', externalReference: 'tr_company' });
    }
    throw new Error('Route inattendue');
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Verser à sa société' }));
  expect(screen.getByText(/Désigner Société Azur/)).toHaveTextContent('Aucun argent');
  expect(http.requests.filter(r => r.method !== 'GET')).toHaveLength(0);
  const select = screen.getByRole('button', { name: 'Confirmer la société' });
  fireEvent.click(select); fireEvent.click(select);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmer la société' })).not.toBeInTheDocument());
  expect(http.requests.filter(r => r.method === 'PUT')).toHaveLength(1);
  expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(0);
  fireEvent.click(await screen.findByRole('button', { name: /Préparer le versement/ }));
  expect(screen.getByText(/compte de la société Société Azur/)).toHaveTextContent('10,00');
  fireEvent.click(screen.getByRole('button', { name: /Verser 10/ }));
  expect(await screen.findByRole('status')).toHaveTextContent('tr_company');
});

it('un conflit de bénéficiaire conserve la confirmation initiale et interdit un nouvel envoi silencieux', async () => {
  let posted = false;
  http.route((request, response) => {
    if (request.method === 'GET' && request.path.endsWith('/transfer-preview')) return json(response, {
      eligible: true, beneficiary: posted ? { ...beneficiary, userId: null, organizationId: 9, name: 'Société Azur', locked: true } : beneficiary,
    });
    if (request.method === 'POST' && request.path.endsWith('/transfer')) {
      expect(JSON.parse(request.body)).toEqual({ userId: 42, organizationId: null });posted = true;
      return json(response, { message: 'Bénéficiaire modifié par un autre administrateur.' }, 409);
    }
    throw new Error('Route inattendue');
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: /Préparer le versement/ }));
  fireEvent.click(screen.getByRole('button', { name: /Verser 10/ }));
  expect(await screen.findByText('Bénéficiaire modifié par un autre administrateur.')).toBeVisible();
  expect(await screen.findByText(/Le bénéficiaire a changé/)).toBeVisible();
  expect(screen.getByText(/compte personnel de Jean Martin/)).toBeVisible();
  expect(screen.getByRole('button', { name: /Verser 10/ })).toBeDisabled();
  expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  fireEvent.click(await screen.findByRole('button', { name: /Préparer le versement/ }));
  expect(screen.getByText(/compte de la société Société Azur/)).toBeVisible();
  expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1);
});
