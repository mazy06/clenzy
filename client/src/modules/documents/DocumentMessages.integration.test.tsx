import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import MessageTemplatesSection from './MessageTemplatesSection';
import WhatsAppTemplatesSection from './WhatsAppTemplatesSection';

const context = vi.hoisted(() => ({ origin: '', scope: 'test:1' }));
vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => context.scope }));
vi.mock('../../components/ScreenChrome', () => ({ useScreenSearch: () => {} }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp(); beforeAll(async () => { context.origin = await http.start(); }); afterAll(() => http.close());
beforeEach(() => { context.scope = 'test:1'; }); afterEach(() => { cleanup(); expect(http.unexpected).toEqual([]); });
function open(whatsapp = false, path = '/documents?tab=message-templates') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = () => <MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}>{whatsapp ? <WhatsAppTemplatesSection /> : <MessageTemplatesSection />}</QueryClientProvider></MemoryRouter>;
  return { ...render(tree()), tree };
}
const system = { templateKey: 'TEST', recipientType: 'GUEST', isCustomized: false, languages: {
  ar: { body: 'رسالة الاختبار', subject: 'العنوان', variables: [] }, fr: { body: 'Contenu français TEST', subject: 'Objet français TEST', variables: ['guestName'] },
} };
it('ouvre le bon modèle depuis le catalogue et choisit le français même si l’arabe arrive en premier', async () => {
  http.route((req, res) => req.path === '/api/system-email-templates' ? json(res, [system])
    : req.path === '/api/document-previews/email' ? json(res, { subject: 'Objet français TEST', html: `<html>${JSON.parse(req.body).body}</html>` }) : json(res, []));
  open(false, '/documents?tab=message-templates&template=TEST');
  expect(await screen.findByTitle('Aperçu de l’email')).toHaveAttribute('srcdoc', '<html>Contenu français TEST</html>');
  expect(screen.queryByText('رسالة الاختبار')).not.toBeInTheDocument();
  expect(http.requests.every(req => req.method === 'GET' || req.path === '/api/document-previews/email')).toBe(true);
});
it('signale une panne des modèles système sans perdre les modèles personnels chargés', async () => {
  http.route((req, res) => req.path === '/api/system-email-templates' ? json(res, { message: 'Indisponible' }, 503)
    : json(res, [{ id: 1, name: 'Modèle personnel TEST', subject: 'Bienvenue', body: 'Bonjour', language: 'fr', isActive: true }]));
  open(); expect(await screen.findByRole('alert')).toBeVisible();
  expect(await screen.findByRole('button', { name: /Modèle personnel TEST/ })).toBeVisible();
});
it('montre le statut Meta de la langue consultée et jamais un faux actif', async () => {
  http.route((req, res) => { expect(req.path).toBe('/api/whatsapp-templates'); return json(res, [{ templateKey: 'TEST', category: 'UTILITY', isCustomized: false,
    languages: { fr_FR: { bodyNamed: 'Bonjour TEST', variables: [], metaApprovalStatus: 'REJECTED' }, en_US: { bodyNamed: 'Hello TEST', variables: [], metaApprovalStatus: 'APPROVED' } },
  }]); });
  open(true); expect(await screen.findByRole('button', { name: 'Refusé par Meta' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Actif' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en_US' } });
  expect(await screen.findByRole('button', { name: 'Approuvé par Meta' })).toBeVisible();
});
it('ne réutilise pas les modèles WhatsApp privés d’une autre organisation', async () => {
  http.route((req, res) => json(res, [{ templateKey: 'PRIVE_TEST', category: 'UTILITY', isCustomized: true, languages: { fr_FR: { bodyNamed: 'TEST', variables: [], metaApprovalStatus: null } } }]));
  const view = open(true); await screen.findByText('PRIVE_TEST');
  http.route((req, res) => json(res, [], 200)); context.scope = 'test:2'; view.rerender(view.tree());
  expect(screen.queryByText('PRIVE_TEST')).not.toBeInTheDocument();
  await waitFor(() => expect(http.requests).toHaveLength(1));
});
