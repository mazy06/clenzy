import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { beforeAll, afterAll, afterEach, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyCommerceEvidencePanel from './BaitlyCommerceEvidencePanel';
vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'test:2' }));
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start();const body = await new Response('').formData().catch(async () => new Response('', { headers: { 'content-type': 'application/x-www-form-urlencoded' } }).formData());vi.stubGlobal('FormData', body.constructor);vi.stubGlobal('Blob', NodeBlob);vi.stubGlobal('File', NodeFile); });
afterAll(async () => { await http.close();vi.unstubAllGlobals(); });afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
const target = { kind: 'INVOICE', reference: 'TX-8', amount: 100, currency: 'EUR' };
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlyCommerceEvidencePanel source="UPSELL" sourceId={8} /></QueryClientProvider>); }
it('rattache une pièce au montant prouvé et conserve la même demande après une réponse perdue', async () => {
  let attempts = 0;const keys: string[] = [];let saved = false;
  http.route((req, res) => {
    expect(req.path).toBe('/api/commerce/evidence?source=UPSELL&sourceId=8');
    if (req.method === 'GET') return json(res, { targets: saved ? [] : [target], documents: saved ? [{ ...target, id: 3, number: 'V-01', issuer: 'Vendeur test' }] : [] });
    expect(req.method).toBe('POST');expect(req.body).toContain('%PDF-1.4 TEST');expect(req.body).toContain('"amount":100');expect(req.body).toContain('"reference":"TX-8"');
    keys.push(req.body.match(/"requestId":"([^"]+)"/)![1]);attempts++;if (attempts === 1) return json(res, { message: 'Réponse perdue' }, 503);saved = true;return json(res, { id: 3 });
  });
  open();await screen.findByLabelText('Numéro de la pièce');
  fireEvent.change(screen.getByLabelText('Numéro de la pièce'), { target: { value: 'V-01' } });fireEvent.change(screen.getByLabelText('Émetteur figurant sur la pièce'), { target: { value: 'Vendeur test' } });fireEvent.change(screen.getByLabelText('Identifiant légal ou référence du mandat'), { target: { value: 'Mandat de test' } });
  fireEvent.change(screen.getByLabelText(/Pièce PDF/), { target: { files: [new File(['%PDF-1.4 TEST'], 'test.pdf', { type: 'application/pdf' })] } });
  // JSDOM ne renseigne pas la valeur native du file input quand files est simulé.
  fireEvent.submit(screen.getByRole('button', { name: 'Rattacher la pièce' }).closest('form')!);await screen.findByRole('alert');await waitFor(() => expect(screen.getByRole('button', { name: 'Rattacher la pièce' })).toBeEnabled());
  fireEvent.submit(screen.getByRole('button', { name: 'Rattacher la pièce' }).closest('form')!);expect(await screen.findByText('Facture vendeur V-01')).toBeVisible();expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
});
it('ne propose aucune émission ou paiement et affiche le blocage de preuve', async () => {
  http.route((req, res) => json(res, { message: 'Vente à rapprocher' }, 409));open();expect(await screen.findByRole('alert')).toHaveTextContent('Vente à rapprocher');expect(screen.queryByRole('button', { name: 'Rattacher la pièce' })).not.toBeInTheDocument();
});
