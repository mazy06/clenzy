import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyOtaSettlementPanel from './BaitlyOtaSettlementPanel';
const context = vi.hoisted(() => ({ origin: '', staff: true, user: { id: 1, organizationId: 7 } }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: context.user, hasRole: () => context.staff }) }));
const http = financeHttp(); const clients: QueryClient[] = [];
const row = { id: 8, ota_reference: 'OTA-42', bank_reference: 'BANK-12', beneficiary_name: 'Jean Martin', currency: 'EUR',
  received_on: '2026-10-01', gross: 100, fees: 10, refunds: 5, net: 85, void_reason: null as string | null };
const detail = { total_price: 100, currency: 'EUR', source: 'AIRBNB', payment_collection: 'CHANNEL', owner_id: 42, owner_name: 'Jean Martin', organization_name: 'Baitly test' };
function mount(id = 1) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><BaitlyOtaSettlementPanel reservationId={id} /></QueryClientProvider>);
}
beforeAll(async () => {
  // Use the same multipart implementation as Node fetch for real HTTP uploads.
  const body = await new Response('--baitly-test--\r\n', { headers: { 'content-type': 'multipart/form-data; boundary=baitly-test' } }).formData();
  vi.stubGlobal('FormData', body.constructor); vi.stubGlobal('Blob', NodeBlob); vi.stubGlobal('File', NodeFile);
  context.origin = await http.start();
});
afterAll(async () => { vi.unstubAllGlobals(); await http.close(); });
beforeEach(() => { context.staff = true; http.route(() => { throw new Error('Unexpected route'); }); });
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); expect(http.unexpected).toEqual([]); });
it('lit le vrai contrat HTTP sans confondre reçu documentaire et solde Stripe', async () => {
  http.route((req, res) => req.path.includes('/context?') ? json(res, detail) : req.path.includes('/candidates?') ? json(res, []) : json(res, [row]));
  mount(); expect(await screen.findByText(/85,00/)).toBeVisible();
  expect(screen.getByText(/Ces fonds ne constituent pas un solde Stripe/)).toBeVisible();
  expect(screen.getByText(/Rapproché sur justificatifs/)).toBeVisible();
  expect(http.requests.every(r => r.method === 'GET')).toBe(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Rapprocher un versement' }));
  expect(screen.getByRole('button', { name: 'Confirmer le rapprochement' })).toBeDisabled();
  expect(screen.getByLabelText('Jean Martin')).toBeChecked();
  expect(screen.getByLabelText('Baitly test')).not.toBeChecked();
});
it('annule une correspondance explicitement sans effacer les documents et résiste au double clic', async () => {
  let reason: string | null = null; let release!: () => void;
  http.route(async (req, res) => {
    if (req.method === 'GET') return req.path.includes('/context?') ? json(res, detail) : json(res, [{ ...row, void_reason: reason }]);
    expect(req.path).toBe('/api/finance/ota-settlements/8/void');
    expect(JSON.parse(req.body)).toEqual({ reason: 'Mauvais relevé bancaire' });
    await new Promise<void>(resolve => { release = resolve; }); reason = 'Mauvais relevé bancaire'; json(res, {});
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Corriger' }));
  fireEvent.change(screen.getByLabelText('Motif de correction'), { target: { value: 'Mauvais relevé bancaire' } });
  const button = screen.getByRole('button', { name: 'Annuler ce rapprochement' }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(http.requests.filter(r => r.method === 'POST')).toHaveLength(1)); release();
  expect(await screen.findByText(/Rapprochement annulé : Mauvais relevé bancaire/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Justificatif bancaire' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Corriger' })).not.toBeInTheDocument();
});
it('refuse de montrer un formulaire si le contexte est indisponible', async () => {
  http.route((req, res) => req.path.includes('/context?') ? json(res, { message: 'Indisponible' }, 503) : json(res, []));
  mount(); expect(await screen.findByRole('alert')).toHaveTextContent('Les justificatifs ne sont pas disponibles');
  expect(screen.queryByRole('button', { name: 'Rapprocher un versement' })).not.toBeInTheDocument();
});
it('ne charge aucun justificatif financier pour un bénéficiaire', () => {
  context.staff = false; const view = mount(); expect(view.container).toBeEmptyDOMElement(); expect(http.requests).toEqual([]);
});
it('ventile plusieurs séjours et choisit le gestionnaire quand les propriétaires diffèrent', async () => {
  http.route((req, res) => req.path.includes('/context?') ? json(res, detail) : req.path.includes('/candidates?')
    ? json(res, [{ id: 2, owner_id: 43, remaining: 50, total_price: 50, property_name: 'Autre logement' }]) : json(res, []));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Rapprocher un versement' }));
  expect(await screen.findByRole('option', { name: 'Séjour n°2 · Autre logement' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter un séjour au versement' }));
  expect(screen.getByLabelText('Baitly test')).toBeChecked();expect(screen.getByLabelText('Jean Martin')).toBeDisabled();
  expect(screen.getByText(/150,00/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retirer ce séjour' }));
  expect(screen.getByText(/100,00/)).toBeVisible();expect(screen.getByLabelText('Jean Martin')).toBeEnabled();
  expect(http.requests.every(r => r.method === 'GET')).toBe(true);
});
it('transmet les deux justificatifs et la ventilation exacte par HTTP une seule fois', async () => {
  let saved = false; let release!: () => void;
  http.route(async (req, res) => {
    if (req.method === 'GET') return req.path.includes('/context?') ? json(res, detail)
      : req.path.includes('/candidates?') ? json(res, []) : json(res, saved ? [row] : []);
    expect(req.path).toBe('/api/finance/ota-settlements');
    expect(req.body).toContain('"beneficiaryUserId":42');
    expect(req.body).toContain('"otaReference":"OTA-42"');
    expect(req.body).toContain('"lines":[{"reservationId":1,"gross":"100.00","fees":"10.00","refunds":"5.00","net":"85.00"}]');
    expect(req.body).toContain('name="statement"'); expect(req.body).toContain('%PDF-1.4 statement');
    expect(req.body).toContain('name="bankReceipt"'); expect(req.body).toContain('%PDF-1.4 bank');
    await new Promise<void>(resolve => { release = resolve; }); saved = true; json(res, { id: 8 });
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Rapprocher un versement' }));
  for (const [label, value] of [['Référence du versement OTA', 'OTA-42'], ['Référence bancaire unique', 'BANK-12'],
    ['Date de réception', '2026-10-01'], ['Frais OTA', '10'], ['Remboursements déduits', '5']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  for (const [label, content] of [['Relevé OTA', 'statement'], ['Justificatif bancaire', 'bank']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { files: [new File([`%PDF-1.4 ${content}`], `${content}.pdf`, { type: 'application/pdf' })] } });
  }
  const form = screen.getByRole('button', { name: 'Confirmer le rapprochement' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(http.requests.filter(req => req.method === 'POST')).toHaveLength(1)); release();
  expect(await screen.findByText(/Rapproché sur justificatifs/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Confirmer le rapprochement' })).not.toBeInTheDocument();
});
