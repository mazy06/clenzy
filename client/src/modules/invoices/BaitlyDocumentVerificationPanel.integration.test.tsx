import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import type { Invoice } from '../../services/api/invoicesApi';
import BaitlyDocumentVerificationPanel from './BaitlyDocumentVerificationPanel';

const context = vi.hoisted(() => ({ origin: '', role: 'OWNER', org: 2 }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'staff', organizationId: context.org, orgRole: context.role }, isPlatformStaff: () => false }) }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());
beforeEach(() => { context.role = 'OWNER';context.org = 2; });
afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
const invoice = { id: 7, countryCode: 'FR', status: 'DRAFT', sellerName: 'Vendeur TEST', sellerAddress: '', sellerTaxId: '123456789', buyerName: 'Acheteur TEST', buyerAddress: '', buyerTaxId: '', legalMentions: 'TEST', dueDate: null } as Invoice;
const initial = { state: 'BLOCKED', sourceHash: 'a'.repeat(64), issues: [{ code: 'SELLER', message: 'Adresse du vendeur à compléter' }], history: [], pdfArchived: false };
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = () => <MemoryRouter><QueryClientProvider client={client}><BaitlyDocumentVerificationPanel invoice={invoice} /></QueryClientProvider></MemoryRouter>;
  return { ...render(tree()), tree };
}
it('la consultation ne déclenche aucun contrôle ni émission automatiquement', async () => {
  http.route((req, res) => { expect(req.method).toBe('GET');return json(res, initial); });open();
  await screen.findByText('Adresse du vendeur à compléter');
  expect(screen.getByRole('button', { name: 'Émettre la facture' })).toBeDisabled();
  expect(http.requests).toHaveLength(1);
});
it('enregistre un brouillon versionné avant de permettre son émission', async () => {
  let current = initial;let issued = false;
  http.route((req, res) => {
    if (req.method === 'GET') return json(res, current);
    if (req.method === 'PUT') {
      const data = JSON.parse(req.body);expect(data.sourceHash).toBe(initial.sourceHash);expect(data.sellerAddress).toBe('1 rue TEST');
      current = { ...initial, state: 'CHECKED', sourceHash: 'b'.repeat(64), issues: [] };return json(res, current);
    }
    expect(req.path).toBe('/api/invoices/7/issue');expect(current.state).toBe('CHECKED');issued = true;return json(res, { ...invoice, status: 'ISSUED' });
  });open();await screen.findByText('Adresse du vendeur à compléter');
  fireEvent.click(screen.getByRole('button', { name: 'Compléter le brouillon' }));
  fireEvent.change(screen.getByLabelText('Adresse du vendeur'), { target: { value: '1 rue TEST' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer et vérifier' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Émettre la facture' })).toBeEnabled());
  expect(issued).toBe(false);fireEvent.click(screen.getByRole('button', { name: 'Émettre la facture' }));
  await waitFor(() => expect(issued).toBe(true));
});
it('une erreur du contrôle reste un blocage visible', async () => {
  http.route((req, res) => req.method === 'GET' ? json(res, initial) : json(res, { message: 'Source modifiée' }, 409));open();
  await screen.findByText('Adresse du vendeur à compléter');fireEvent.click(screen.getByRole('button', { name: 'Vérifier le document' }));
  await screen.findByRole('alert');expect(screen.getByRole('button', { name: 'Émettre la facture' })).toBeDisabled();
  expect(http.requests.filter(r => r.path.endsWith('/issue'))).toHaveLength(0);
});
it('un changement d’organisation ne réutilise pas le contrôle en cache', async () => {
  http.route((req, res) => json(res, { ...initial, state: 'CHECKED', issues: [] }));const result = open();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Émettre la facture' })).toBeEnabled());
  http.route((req, res) => json(res, { message: 'Facture inaccessible' }, 403));context.org = 3;result.rerender(result.tree());
  expect(screen.queryByRole('button', { name: 'Émettre la facture' })).not.toBeInTheDocument();await screen.findByRole('alert');
});
it('les membres sans droits de gestion ne chargent pas le dossier fiscal', () => {
  context.role = 'MEMBER';http.route(() => { throw new Error('Aucun appel attendu'); });open();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(http.requests).toHaveLength(0);
});
