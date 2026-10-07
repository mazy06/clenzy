import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyExternalBatchRefundPanel from './BaitlyExternalBatchRefundPanel';

const context = vi.hoisted(() => ({ origin: '', staff: true, user: { id: 1, organizationId: 7 } }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: context.user, hasRole: () => context.staff }) }));
const http = financeHttp(); const clients: QueryClient[] = [];
const row = { reference: 'EXT-re_batch', stripeReference: 're_batch', amount: 5.01, currency: 'EUR', interventionId: null, assigned: false, confirmed: false, assignable: true, reviewRequired: false };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><BaitlyExternalBatchRefundPanel interventionId={10} label="Ménage de départ" /></QueryClientProvider>);
}
beforeAll(async () => { context.origin = await http.start(); });
afterAll(async () => { await http.close(); });
beforeEach(() => { context.staff = true; context.user.organizationId = 7; });
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); expect(http.unexpected).toEqual([]); });

it('lit les preuves sans effectuer de remboursement et exige un motif explicite', async () => {
  http.route((req, res) => { expect(req.path).toBe('/api/payments/10/external-batch-refunds'); json(res, [row]); });
  mount(); expect(await screen.findByText(/5,01/)).toBeVisible(); expect(http.requests.every(r => r.method === 'GET')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Affecter à cette prestation' }));
  expect(screen.getByText('Affectation à Ménage de départ · n°10')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Confirmer l’affectation' })).toBeDisabled();
  expect(screen.getByText(/Aucun nouveau remboursement ne sera envoyé/)).toBeVisible();
});
it('envoie une affectation unique puis distingue attente et confirmation', async () => {
  let saved = false; let release!: () => void;
  http.route(async (req, res) => {
    if (req.method === 'GET') return json(res, [{ ...row, assigned: saved, interventionId: saved ? 10 : null }]);
    expect(req.path).toBe('/api/payments/10/external-batch-refunds/EXT-re_batch/assignment');
    expect(JSON.parse(req.body)).toEqual({ amount: 5.01, currency: 'EUR', reason: 'Correction ménage du logement' });
    await new Promise<void>(resolve => { release = resolve; }); saved = true; json(res, { ...row, assigned: true, interventionId: 10 }, 202);
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Affecter à cette prestation' }));
  fireEvent.change(screen.getByLabelText('Motif de cette affectation'), { target: { value: 'Correction ménage du logement' } });
  const form = screen.getByRole('button', { name: 'Confirmer l’affectation' }).closest('form')!; fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1)); release();
  expect(await screen.findByRole('status')).toHaveTextContent('vérification Stripe et comptable en attente');
  expect(screen.queryByRole('button', { name: 'Affecter à cette prestation' })).not.toBeInTheDocument();
  expect(screen.queryByText('Remboursement rapproché sur cette prestation.')).not.toBeInTheDocument();
});
it('conserve le motif après un refus serveur et ne prétend pas avoir rapproché', async () => {
  http.route((req, res) => req.method === 'GET' ? json(res, [row]) : json(res, { message: 'Le remboursement dépasse le solde de cette prestation' }, 400));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Affecter à cette prestation' }));
  fireEvent.change(screen.getByLabelText('Motif de cette affectation'), { target: { value: 'Dossier vérifié' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’affectation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('dépasse le solde');
  expect(screen.getByLabelText('Motif de cette affectation')).toHaveValue('Dossier vérifié');
});
it('affiche la confirmation uniquement lorsque le serveur la fournit', async () => {
  http.route((req, res) => json(res, [{ ...row, assigned: true, confirmed: true, interventionId: 10 }])); mount();
  expect(await screen.findByRole('status')).toHaveTextContent('Remboursement rapproché');
  expect(screen.queryByRole('button', { name: 'Affecter à cette prestation' })).not.toBeInTheDocument();
});
it('ne charge aucune preuve pour un bénéficiaire', () => {
  http.route(() => { throw new Error('Unexpected route'); }); context.staff = false;
  expect(mount().container).toBeEmptyDOMElement(); expect(http.requests).toEqual([]);
});
it('signale un rapprochement bloqué sans annoncer de confirmation', async () => {
  http.route((req, res) => json(res, [{ ...row, assigned: true, reviewRequired: true, interventionId: 10 }])); mount();
  expect(await screen.findByRole('status')).toHaveTextContent('Rapprochement bloqué');
  expect(screen.queryByRole('button', { name: 'Affecter à cette prestation' })).not.toBeInTheDocument();
});
it('attend une preuve Stripe confirmée avant de proposer une affectation', async () => {
  http.route((req, res) => json(res, [{ ...row, assignable: false }])); mount();
  expect(await screen.findByText('Confirmation Stripe en attente.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Affecter à cette prestation' })).not.toBeInTheDocument();
});
it('propose une reprise si les preuves ne sont pas disponibles', async () => {
  http.route((req, res) => json(res, { message: 'Indisponible' }, 503)); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Les remboursements du lot ne sont pas disponibles');
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible();
});

it('répartit une preuve entre deux prestations avec un total exact avant envoi', async () => {
  let saved = false;
  http.route((req, res) => {
    if (req.path.endsWith('/targets')) return json(res, [{ interventionId: 10, label: 'Prestation #10', remaining: 3, currency: 'EUR' }, { interventionId: 20, label: 'Prestation #20', remaining: 4, currency: 'EUR' }]);
    if (req.method === 'GET') return json(res, [{ ...row, assigned: saved }]);
    expect(req.path).toBe('/api/payments/10/external-batch-refunds/EXT-re_batch/distribution');
    expect(JSON.parse(req.body)).toEqual({ amount: 5.01, currency: 'EUR', reason: 'Deux prestations', portions: [{ interventionId: 10, amount: 2 }, { interventionId: 20, amount: 3.01 }] });
    saved = true; json(res, { ...row, assigned: true }, 202);
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Affecter à cette prestation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Répartir entre plusieurs prestations' }));
  const first = await screen.findByLabelText('Montant pour la prestation 10');
  fireEvent.change(screen.getByLabelText('Motif de cette affectation'), { target: { value: 'Deux prestations' } });
  fireEvent.change(first, { target: { value: '2' } });
  expect(screen.getByRole('button', { name: 'Confirmer l’affectation' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Montant pour la prestation 20'), { target: { value: '3,01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’affectation' }));
  expect(await screen.findByText(/vérification Stripe et comptable en attente/)).toBeVisible();
  expect(http.requests.filter(req => req.method === 'POST')).toHaveLength(1);
});
