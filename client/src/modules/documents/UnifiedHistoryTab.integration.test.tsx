import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import UnifiedHistoryTab from './UnifiedHistoryTab';

const context = vi.hoisted(() => ({ origin: '', scope: 'test:1', reviewer: true }));
vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => context.scope }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { orgRole: context.reviewer ? 'ADMIN' : 'MEMBER' }, isPlatformStaff: () => false, hasRole: () => false }) }));
vi.mock('../../components/ScreenChrome', () => ({ useScreenSearch: () => {} }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
beforeEach(() => { context.scope = 'test:1'; context.reviewer = true; });
afterEach(() => { cleanup(); expect(http.unexpected).toEqual([]); });

const generation = { id: 42, templateName: 'Facture TEST', documentType: 'FACTURE', legalNumber: 'TEST-42', status: 'COMPLETED', fileName: 'test.pdf', createdAt: '2026-10-01T10:00:00Z' };
const logs = [
  { id: 1, templateName: 'Email TEST', templateId: 8, recipient: 'test@example.invalid', guestId: 2, channel: 'EMAIL', status: 'FAILED', createdAt: '2026-10-01T10:00:00Z' },
  { id: 2, templateName: 'SMS TEST', templateId: 9, recipient: 'N/A', guestId: 2, channel: 'SMS', status: 'FAILED', createdAt: '2026-10-01T10:00:00Z' },
];
function route() {
  http.route((req, res) => {
    if (req.path.startsWith('/api/documents/generations?')) return json(res, { content: [generation], totalElements: 1 });
    if (req.path === '/api/documents/types') return json(res, []);
    if (req.path === '/api/guest-messaging/history') return json(res, logs);
    if (req.path === '/api/guest-messaging/preview/1') return json(res, { htmlBody: '<script>evil()</script>Contenu TEST', subject: 'Aperçu' });
    if (req.path === '/api/guest-messaging/resend/1' && req.method === 'POST') return json(res, { message: 'Indisponible' }, 503);
    throw new Error(`Appel inattendu : ${req.method} ${req.path}`);
  });
}
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={['/documents?tab=history']}><QueryClientProvider client={client}><UnifiedHistoryTab /></QueryClientProvider></MemoryRouter>);
}
it('affiche les actions PDF dans le détail et le lien vers le dossier fiscal canonique', async () => {
  route(); open();
  fireEvent.click(await screen.findByRole('button', { name: /TEST-42/ }));
  expect(screen.getByRole('button', { name: 'Télécharger' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Ouvrir le centre Conformité' })).toHaveAttribute('href', '/documents?tab=compliance&generation=42');
  expect(http.requests.every(req => req.method === 'GET')).toBe(true);
});
it('ne propose pas la revue fiscale à un membre sans droit', async () => {
  context.reviewer = false; route(); open();
  fireEvent.click(await screen.findByRole('button', { name: /TEST-42/ }));
  expect(screen.queryByRole('link', { name: 'Ouvrir le centre Conformité' })).not.toBeInTheDocument();
});
it('isole les aperçus et signale un échec de renvoi sans prétendre que le message a été envoyé', async () => {
  route(); open();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EMAIL' } });
  fireEvent.click(await screen.findByRole('button', { name: /Email TEST/ }));
  const preview = await screen.findByTitle("Contenu de l'email");
  expect(preview).toHaveAttribute('sandbox', '');
  expect(preview.getAttribute('srcdoc')).toContain("default-src 'none'");
  expect(http.requests.every(req => req.method === 'GET')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Renvoyer' }));
  await screen.findByRole('alert');
  await waitFor(() => expect(http.requests.filter(req => req.method === 'POST')).toHaveLength(1));
  expect(screen.getAllByRole('button', { name: 'Échec' })).toHaveLength(2);
});
it('bloque le renvoi sans destinataire et ne propose jamais de changer un email pour un SMS', async () => {
  route(); open();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SMS' } });
  fireEvent.click(await screen.findByRole('button', { name: /SMS TEST/ }));
  expect(screen.getByRole('button', { name: 'Renvoyer' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /email/i })).not.toBeInTheDocument();
  expect(http.requests.every(req => req.method === 'GET')).toBe(true);
});
