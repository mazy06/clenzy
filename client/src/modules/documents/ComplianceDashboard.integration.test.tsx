import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import ComplianceDashboard from './ComplianceDashboard';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'reviewer', organizationId: 2, orgRole: 'OWNER' }, isPlatformStaff: () => false }) }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());
afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
const invoices = ['FR', 'MA'].map((countryCode, index) => ({
  invoice: { id: index + 1, documentGenerationId: index + 10, invoiceNumber: `TEST-${countryCode}`, countryCode, buyerName: 'Destinataire TEST', sellerName: 'Vendeur TEST', currency: index ? 'MAD' : 'EUR', totalTtc: 120, status: 'ISSUED' },
  state: 'CHECKED', issueCount: 0, pdfArchived: true,
}));
function open(path = '/documents?tab=compliance') {
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ComplianceDashboard /></QueryClientProvider></MemoryRouter>);
}
function route() {
  http.route((req, res) => {
    expect(req.method).toBe('GET');
    if (req.path === '/api/document-verification') return json(res, invoices);
    if (req.path === '/api/fiscal-profile/submissions') return json(res, [{ id: 1, invoiceId: 1, invoiceNumber: 'Transmission TEST', country: 'FR', status: 'PENDING' }]);
    if (req.path === '/api/document-verification/1') return json(res, { state: 'CHECKED', sourceHash: 'a'.repeat(64), issues: [], history: [], pdfArchived: true });
    throw new Error(`Appel inattendu : ${req.path}`);
  });
}
it('le filtre pays consulte les dossiers sans modifier les paramètres fiscaux', async () => {
  route();open();await screen.findByText('TEST-MA');
  fireEvent.change(screen.getByLabelText('Pays fiscal'), { target: { value: 'FR' } });
  await waitFor(() => expect(screen.queryByText('TEST-MA')).not.toBeInTheDocument());
  expect(screen.getByText('TEST-FR')).toBeVisible();expect(http.requests.every(req => req.method === 'GET')).toBe(true);
});
it('une transmission ouvre le même panneau de vérification que Finance', async () => {
  route();open();fireEvent.click(await screen.findByRole('button', { name: 'Transmission TEST' }));
  expect(await screen.findByRole('region', { name: 'Vérification du document' })).toBeVisible();
  expect(await screen.findByText('PDF émis archivé : les téléchargements servent le même fichier.')).toBeVisible();
  expect(http.requests.filter(req => req.path === '/api/document-verification/1')).toHaveLength(1);
});
it('le lien Historique retrouve la facture canonique depuis son PDF', async () => {
  route();open('/documents?tab=compliance&generation=10');
  expect(await screen.findByRole('region', { name: 'Vérification du document' })).toBeVisible();
});
