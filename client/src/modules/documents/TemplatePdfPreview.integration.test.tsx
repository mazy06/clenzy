import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import TemplatePdfPreview from './TemplatePdfPreview';

const context = vi.hoisted(() => ({ origin: '', scope: 'test:1' }));
vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => context.scope }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('../../components/PageHeader', () => ({ default: ({ title, actions }: { title: string; actions: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock('../../components/BaitlyPdfPreview', () => ({ default: ({ url, title, actions }: { url: string; title: string; actions: React.ReactNode }) => <section title={title} data-url={url}>{actions}</section> }));

const http = financeHttp();
const createUrl = vi.fn();
const revokeUrl = vi.fn();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
beforeEach(() => {
  let sequence = 0;
  context.scope = 'test:1';
  createUrl.mockReset().mockImplementation(() => `blob:pdf-test-${++sequence}`);
  revokeUrl.mockReset();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createUrl;
    static revokeObjectURL = revokeUrl;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); expect(http.unexpected).toEqual([]); });

function routePreview(content = '%PDF-1.7\nTEST', mime = 'application/pdf', status = 200) {
  http.route((req, res) => {
    if (req.path.endsWith('/preview')) {
      res.writeHead(status, { 'content-type': mime }); res.end(content); return;
    }
    json(res, { id: Number(req.path.split('/').at(-1)), name: 'Autorisation Travaux Clenzy', version: 1, active: true,
      documentType: 'AUTORISATION_TRAVAUX', originalFilename: 'travaux.odt', tags: [] });
  });
}
function PreviewSelection() { const [id, setId] = useState(5); return <><button onClick={() => setId(6)}>Autre modèle</button><TemplatePdfPreview key={id} id={id} name="Autorisation Travaux Clenzy" version={1} /></>; }
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><PreviewSelection /></QueryClientProvider>);
}

it('transmet un PDF validé au lecteur et libère chaque aperçu remplacé', async () => {
  routePreview(); const view = open();
  const viewer = await screen.findByTitle('Aperçu PDF du template');
  expect(viewer).toHaveAttribute('data-url', 'blob:pdf-test-1');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(createUrl.mock.calls[0][0].type).toBe('application/pdf');
  fireEvent.click(screen.getByRole('button', { name: "Regénérer l'aperçu" }));
  await waitFor(() => expect(screen.getByTitle('Aperçu PDF du template')).toHaveAttribute('data-url', 'blob:pdf-test-2'));
  expect(revokeUrl).toHaveBeenCalledWith('blob:pdf-test-1');
  view.unmount(); expect(revokeUrl).toHaveBeenCalledWith('blob:pdf-test-2');
});

it.each([
  ['<html>Erreur du proxy</html>', 'text/html'],
  ['<html>Faux PDF</html>', 'application/pdf'],
  ['', 'application/pdf'],
])('refuse une réponse non PDF avant de créer une URL affichable (%s)', async (body, mime) => {
  routePreview(body, mime); open();
  expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur n’a pas renvoyé un PDF valide.');
  expect(createUrl).not.toHaveBeenCalled();
  expect(screen.queryByTitle('Aperçu PDF du template')).not.toBeInTheDocument();
});

it('présente une erreur HTTP puis permet de regénérer le PDF', async () => {
  routePreview('Indisponible', 'text/plain', 503); open();
  expect(await screen.findByRole('alert')).toHaveTextContent('Erreur');
  routePreview(); fireEvent.click(screen.getByRole('button', { name: "Regénérer l'aperçu" }));
  expect(await screen.findByTitle('Aperçu PDF du template')).toHaveAttribute('data-url', 'blob:pdf-test-1');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('annule un aperçu en cours quand on change de modèle et conserve le nouveau', async () => {
  let finishOld: (() => void) | undefined;
  http.route((req, res) => {
    if (req.path.endsWith('/preview')) {
      const finish = () => { res.writeHead(200, { 'content-type': 'application/pdf' }); res.end('%PDF-1.7\nTEST'); };
      if (req.path.includes('/5/')) finishOld = finish;
      else finish();
      return;
    }
    json(res, { id: Number(req.path.split('/').at(-1)), name: 'Modèle TEST', version: 1, active: true, tags: [] });
  });
  open(); await waitFor(() => expect(finishOld).toBeDefined());
  fireEvent.click(screen.getByRole('button', { name: 'Autre modèle' }));
  expect(await screen.findByTitle('Aperçu PDF du template')).toHaveAttribute('data-url', 'blob:pdf-test-1');
  finishOld!();
  await waitFor(() => expect(http.requests.some(req => req.path === '/api/documents/templates/6/preview')).toBe(true));
  expect(createUrl).toHaveBeenCalledTimes(1);
});
