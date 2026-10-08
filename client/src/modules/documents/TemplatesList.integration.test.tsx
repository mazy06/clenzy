import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import TemplatesList from './TemplatesList';
import TemplatePreviewRedirect from './TemplatePreviewRedirect';

const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'test:1' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('../../components/ScreenChrome', () => ({ useScreenSearch: () => {} }));
vi.mock('./TemplateUpload', () => ({ default: () => null }));
vi.mock('../../components/BaitlyPdfPreview', () => ({ default: ({ url, title, actions }: { url: string; title: string; actions: React.ReactNode }) => <section title={title} data-url={url}>{actions}</section> }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
beforeEach(() => {
  let n = 0;
  vi.stubGlobal('URL', class extends URL { static createObjectURL = () => `blob:test-${++n}`; static revokeObjectURL = vi.fn(); });
  http.route((req, res) => {
    if (req.path.endsWith('/preview')) { res.writeHead(200, { 'content-type': 'application/pdf' }); res.end('%PDF-1.7\nTEST'); return; }
    if (req.path === '/api/documents/templates') {
      json(res, [5, 6].map(id => ({ id, name: `Modèle ${id}`, active: true, version: 1, documentType: 'DEVIS', description: 'Détail masqué', originalFilename: 'test.html', createdBy: 'private@example.invalid', tags: [] }))); return;
    }
    http.unexpected.push(req.path); json(res, {}, 404);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); expect(http.unexpected).toEqual([]); });
function open(path = '/documents') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/documents" element={<TemplatesList />} />
    <Route path="/documents/templates/:id" element={<TemplatePreviewRedirect />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}

it('ne charge que le PDF sélectionné et remplace le panneau de métadonnées', async () => {
  open(); fireEvent.click(await screen.findByRole('button', { name: /Modèle 5\s*v1/ }));
  expect(await screen.findByTitle('Aperçu PDF du template')).toHaveAttribute('data-url', 'blob:test-1');
  expect(screen.queryByText('Détail masqué')).not.toBeInTheDocument();
  expect(screen.queryByText('private@example.invalid')).not.toBeInTheDocument();
  expect(screen.queryByText('Variables disponibles')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Télécharger|Ouvrir/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Modèle 6\s*v1/ }));
  await waitFor(() => expect(screen.getByTitle('Aperçu PDF du template')).toHaveAttribute('data-url', 'blob:test-2'));
  expect(http.requests.filter(req => req.path.endsWith('/preview')).map(req => req.path)).toEqual(['/api/documents/templates/5/preview', '/api/documents/templates/6/preview']);
});

it('redirige les anciens liens de détail sur le PDF de la bibliothèque', async () => {
  open('/documents/templates/6');
  await screen.findByTitle('Aperçu PDF du template');
  expect(screen.getByRole('button', { name: /Modèle 6\s*v1/ })).toHaveAttribute('aria-pressed', 'true');
  expect(http.requests.some(req => req.path === '/api/documents/templates/6/preview')).toBe(true);
});
