import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import EmailTemplatePreview from './EmailTemplatePreview';
import TemplateCatalogAccordions from './TemplateCatalogAccordions';
import type { DocumentTemplate } from '../../services/api/documentsApi';

const context = vi.hoisted(() => ({ origin: '', scope: 'test:1' }));
vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => context.scope }));
vi.mock('../../components/ScreenChrome', () => ({ useScreenSearch: () => {} }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('./TemplatePdfPreview', () => ({ default: ({ id }: { id: number }) => <div data-testid="pdf-preview">PDF {id}</div> }));
const http = financeHttp(); beforeAll(async () => { context.origin = await http.start(); }); afterAll(() => http.close());
beforeEach(() => { context.scope = 'test:1'; });
afterEach(() => { cleanup(); expect(http.unexpected).toEqual([]); });

it('affiche le rendu serveur dans un cadre isolé sans possibilité d’envoi ni téléchargement', async () => {
  http.route((req, res) => {
    expect(req.path).toBe('/api/document-previews/email'); expect(req.method).toBe('POST');
    expect(JSON.parse(req.body)).toMatchObject({ subject: 'Bonjour {guestName}', wrapperStyle: 'INVITATION', language: 'fr' });
    json(res, { subject: 'Bonjour Camille Exemple', html: '<html><body>APERÇU FICTIF</body></html>' });
  });
  render(<EmailTemplatePreview subject="Bonjour {guestName}" body="Texte" wrapperStyle="INVITATION" />);
  const frame = await screen.findByTitle('Aperçu de l’email');
  expect(frame).toHaveAttribute('sandbox', ''); expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(frame).toHaveAttribute('srcdoc', '<html><body>APERÇU FICTIF</body></html>');
  expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Envoyer|Télécharger/ })).not.toBeInTheDocument();
});

it('efface immédiatement l’ancien aperçu en changeant d’organisation et ignore sa réponse tardive', async () => {
  let finishOld: (() => void) | undefined;
  http.route((_, res) => { finishOld = () => json(res, { subject: 'Ancien', html: '<html>Ancien</html>' }); });
  const element = <EmailTemplatePreview subject="Exemple" body="Corps" />;
  const view = render(element); await waitFor(() => expect(finishOld).toBeDefined());
  context.scope = 'test:2'; http.route((_, res) => json(res, { subject: 'Nouveau', html: '<html>Nouveau</html>' }));
  view.rerender(<EmailTemplatePreview subject="Exemple" body="Corps" />);
  expect(screen.queryByTitle('Aperçu de l’email')).not.toBeInTheDocument();
  expect(await screen.findByTitle('Aperçu de l’email')).toHaveAttribute('srcdoc', '<html>Nouveau</html>');
  finishOld!(); expect(screen.getByTitle('Aperçu de l’email')).toHaveAttribute('srcdoc', '<html>Nouveau</html>');
});

it('permet de réessayer une erreur de rendu sans envoyer un email', async () => {
  http.route((_, res) => json(res, { message: 'Erreur de test' }, 503));
  render(<EmailTemplatePreview subject="Exemple" body="Corps" />);
  expect(await screen.findByRole('alert')).toBeVisible();
  http.route((_, res) => json(res, { subject: 'Exemple', html: '<html>Fictif</html>' }));
  fireEvent.click(screen.getByRole('button', { name: "Regénérer l'aperçu" }));
  expect(await screen.findByTitle('Aperçu de l’email')).toBeVisible();
});

it('sélectionne un email ou un PDF dans Parcours, avec le modèle actif et la bonne langue', async () => {
  http.route((req, res) => {
    if (req.path === '/api/message-templates') return json(res, [
      { id: 1, type: 'CHECK_IN', language: 'ar', subject: 'عربي', body: 'عربي', isActive: true },
      { id: 2, type: 'CHECK_IN', language: 'fr', subject: 'Arrivée {guestName}', body: 'Instructions {arrivalInstructions}', isActive: true },
    ]);
    if (req.path === '/api/system-email-templates') return json(res, []);
    expect(req.path).toBe('/api/document-previews/email'); expect(JSON.parse(req.body).body).toContain('arrivalInstructions');
    return json(res, { subject: 'Arrivée Camille Exemple', html: '<html>Consignes fictives</html>' });
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const template = { id: 5, name: 'Devis Baitly', documentType: 'DEVIS', active: true, version: 1 } as DocumentTemplate;
  render(<MemoryRouter><QueryClientProvider client={query}><TemplateCatalogAccordions templates={[template]} onOpenUpload={vi.fn()} /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^Instructions d.arrivée/ }));
  expect(await screen.findByTitle('Aperçu de l’email')).toHaveAttribute('srcdoc', '<html>Consignes fictives</html>');
  expect(screen.queryByText('Variables disponibles')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Devis\s*PDF$/ }));
  expect(screen.getByTestId('pdf-preview')).toHaveTextContent('PDF 5');
  expect(screen.queryByTitle('Aperçu de l’email')).not.toBeInTheDocument();
  expect(screen.queryByText('Envoi tarifaire')).not.toBeInTheDocument();
});
