import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { financeHttp, json } from '../../../../tests/fixtures/baitlyFinanceHttp';
import BaitlySupplierPurchases from './BaitlySupplierPurchases';
import BaitlySupplierInvitationPage from '../../invitations/BaitlySupplierInvitationPage';
import type { SupplierPurchase } from '../../../services/api/baitlySupplierPurchasesApi';
const context = vi.hoisted(() => ({ origin: '', staff: true, user: { id: 1, organizationId: 7 } as { id: number; organizationId?: number } | null }));
vi.mock('../../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' }, resolveMediaUrl: (url: string) => url }));
vi.mock('../../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: context.user, loading: false, hasRole: () => context.staff }) }));
const http = financeHttp(); const clients: QueryClient[] = [];
const row: SupplierPurchase = { id: 1, property_id: 10, property_name: 'Maison test', supplier_name: 'Linge test', invoice_reference: 'INV-1', description: 'Draps',
  expense_date: '2026-10-01', amount_ttc: 60, currency: 'EUR', mode: null, beneficiary_user_id: null, expense_id: null, expense_status: null,
  external_url: null, external_reference: null, external_received_on: null, invitation_expires_at: null };
const token = '00000000-0000-4000-8000-000000000001.00000000-0000-4000-8000-000000000002';
function mount(invitation = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  return render(<MemoryRouter initialEntries={[`/supplier-invitation?token=${token}`]}><QueryClientProvider client={client}>
    {invitation ? <BaitlySupplierInvitationPage /> : <BaitlySupplierPurchases />}</QueryClientProvider></MemoryRouter>);
}
function read(req: { path: string }, res: Parameters<typeof json>[0], purchase: SupplierPurchase) {
  if (req.path === '/api/finance/supplier-purchases') return json(res, [purchase]);
  if (req.path === '/api/properties/10') return json(res, { id: 10, name: 'Maison test' });
  throw new Error(req.path);
}
async function select() { fireEvent.click(await screen.findByRole('button', { name: /Linge test.*60/ })); }
beforeAll(async () => {
  // Node fetch needs its own multipart implementation, rather than JSDOM's DOM-only FormData.
  const body = await new Response('--baitly-test--\r\n', { headers: { 'content-type': 'multipart/form-data; boundary=baitly-test' } }).formData();
  vi.stubGlobal('FormData', body.constructor); vi.stubGlobal('Blob', NodeBlob); vi.stubGlobal('File', NodeFile);
  context.origin = await http.start();
});
afterAll(async () => { vi.unstubAllGlobals(); await http.close(); });
beforeEach(() => { context.staff = true; context.user = { id: 1, organizationId: 7 }; http.route(() => { throw new Error('Unexpected route'); }); });
afterEach(async () => {
  // Une requête encore en vol (ex. lecture du bien après la sélection) ne doit pas atterrir dans le test suivant,
  // dont le journal HTTP est remis à zéro : on attend qu'elles soient terminées avant de démonter.
  await waitFor(() => clients.forEach(c => { expect(c.isFetching()).toBe(0); expect(c.isMutating()).toBe(0); }));
  cleanup(); clients.splice(0).forEach(c => c.clear()); vi.restoreAllMocks(); expect(http.unexpected).toEqual([]);
});
it('propose les deux parcours sans créer une dette ou payer à la lecture', async () => {
  http.route((req, res) => read(req, res, row)); mount(); await select();
  expect(screen.getByRole('button', { name: 'Inviter sur Baitly' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Payer sur le site du fournisseur' })).toBeVisible();
  expect(http.requests.every(req => req.method === 'GET')).toBe(true);
});
it('confirme une invitation une seule fois et retire ensuite le parcours externe', async () => {
  let current = row; let release!: () => void;
  http.route(async (req, res) => {
    if (req.method === 'GET') return read(req, res, current);
    expect(req.path).toBe('/api/finance/supplier-purchases/1/invitation');
    await new Promise<void>(resolve => { release = resolve; }); current = { ...row, mode: 'BAITLY' }; json(res, { path: `/supplier-invitation?token=${token}` });
  }); mount(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Inviter sur Baitly' }));
  const button = screen.getByRole('button', { name: 'Créer l’invitation' }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1)); release();
  expect(await screen.findByLabelText('Lien d’invitation')).toHaveValue(`${window.location.origin}/supplier-invitation?token=${token}`);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Payer sur le site du fournisseur' })).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Préparer la dépense à approuver' })).not.toBeInTheDocument();
});
it('montre une erreur de préparation sans annoncer le paiement et permet une reprise', async () => {
  http.route((req, res) => req.method === 'GET' ? read(req, res, { ...row, mode: 'BAITLY', beneficiary_user_id: 42 }) : json(res, { message: 'Facture déjà enregistrée' }, 409));
  mount(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Préparer la dépense à approuver' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Facture déjà enregistrée');
  expect(screen.getByRole('button', { name: 'Préparer la dépense à approuver' })).toBeEnabled();
  expect(screen.queryByRole('link', { name: /Consulter la dépense/ })).not.toBeInTheDocument();
});
it('le justificatif externe ne propose plus de règlement Baitly', async () => {
  http.route((req, res) => read(req, res, { ...row, mode: 'EXTERNAL', external_reference: 'PAY-1' })); mount(); await select();
  expect(screen.getByRole('status')).toHaveTextContent('Règlement externe documenté : PAY-1');
  expect(screen.getByRole('button', { name: 'Justificatif du règlement' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Inviter sur Baitly' })).not.toBeInTheDocument();
  expect(http.requests.every(req => req.method === 'GET')).toBe(true);
});
it('le bénéficiaire accepte explicitement sans obtenir les factures du client', async () => {
  context.staff = false; context.user = { id: 42 };
  const events = vi.spyOn(window, 'dispatchEvent');
  http.route((req, res) => {
    expect(req.path).toBe('/api/me/supplier-invitations/accept'); expect(JSON.parse(req.body)).toEqual({ token });
    json(res, { supplierName: 'Linge test', invoiceReference: 'INV-1', amount: 60, currency: 'EUR' });
  }); mount(true); expect(http.requests).toEqual([]); fireEvent.click(screen.getByRole('button', { name: 'Accepter l’invitation' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Invitation acceptée pour Linge test');
  expect(screen.getByRole('link', { name: 'Configurer mon compte de versement' })).toHaveAttribute('href', '/account?tab=payouts');
  expect(events.mock.calls.filter(([event]) => event.type === 'force-user-reload')).toHaveLength(1);
  expect(http.requests).toHaveLength(1);
});
it('une session non connectée ne peut pas accepter silencieusement le lien', () => {
  context.user = null; mount(true); expect(screen.getByRole('link', { name: 'Se connecter' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Accepter l’invitation' })).not.toBeInTheDocument(); expect(http.requests).toEqual([]);
});
it('ne charge aucune facture pour le fournisseur', () => {
  context.staff = false; const result = mount(); expect(result.container).toBeEmptyDOMElement(); expect(http.requests).toEqual([]);
});
it('active un compte fournisseur sans inscription payante et sans accepter la facture avant connexion', async () => {
  context.user = null;
  http.route((req, res) => {
    expect(req.path).toBe('/api/invitations/register?kind=supplier');
    expect(JSON.parse(req.body)).toEqual({ token, email: 'supplier@test.invalid', firstName: 'Jean', lastName: 'Martin' });
    json(res, { status: 'ACTIVATION_SENT' }, 202);
  }); mount(true); fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }));
  fireEvent.change(screen.getByLabelText('Adresse email invitée'), { target: { value: 'supplier@test.invalid' } });
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Jean' } });
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Martin' } });
  const button = screen.getByRole('button', { name: 'Recevoir le lien d’activation' }); fireEvent.click(button); fireEvent.click(button);
  expect(await screen.findByRole('status')).toHaveTextContent('Vérifiez votre adresse');
  expect(http.requests).toHaveLength(1); expect(screen.queryByRole('link', { name: 'Créer un compte' })).not.toBeInTheDocument();
});
it('envoie le justificatif externe et son montant exact en multipart, puis conserve le parcours externe', async () => {
  let current = { ...row, mode: 'EXTERNAL' as const, external_url: 'https://supplier.test.invalid/pay' };
  http.route((req, res) => {
    if (req.method === 'GET') return read(req, res, current);
    expect(req.path).toBe('/api/finance/supplier-purchases/1/external-receipt');
    expect(req.body).toContain('name="request"'); expect(req.body).toContain('"amount":60');
    expect(req.body).toContain('"reference":"PAY-60"');expect(req.body).toContain('name="receipt"');
    expect(req.body).toContain('%PDF-1.4 receipt test');current = { ...current, external_reference: 'PAY-60' };json(res, null);
  });mount();await select();
  fireEvent.change(screen.getByLabelText('Référence du règlement'), { target: { value: 'PAY-60' } });
  fireEvent.change(screen.getByLabelText('Date du règlement'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Justificatif du règlement'), { target: { files: [new File(['%PDF-1.4 receipt test'], 'receipt.pdf', { type: 'application/pdf' })] } });
  // JSDOM does not populate the native file input value; exercise the form handler after selection.
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer le justificatif' }).closest('form')!);
  expect(await screen.findByRole('status')).toHaveTextContent('Règlement externe documenté : PAY-60');
  expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1);
});
