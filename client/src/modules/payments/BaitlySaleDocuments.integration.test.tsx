vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'test:2' }));
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlySaleDocuments from './BaitlySaleDocuments';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlySaleDocuments source="HARDWARE_ORDER" sourceId={8} /></QueryClientProvider>); }
const doc = { id: 1, sourceRef: 'TX-1', kind: 'INVOICE', state: 'READY', number: 'FR-001', currency: 'EUR', totalCents: 1200, netCents: 1000, pdfUrl: 'https://pay.stripe.com/invoice/pdf', failure: null };
it('affiche la facture HT/TTC et l’avoir provenant de la commande autorisée', async () => {
  http.route((req, res) => { expect(req.path).toContain('/shop/orders/8/documents');return json(res, [doc, { ...doc, id: 2, kind: 'CREDIT_NOTE', number: 'FR-C001' }]); });
  open();expect(await screen.findByText('Facture FR-001')).toBeVisible();expect(screen.getByText('Avoir FR-C001')).toBeVisible();expect(screen.getAllByRole('link', { name: 'Ouvrir le PDF' })).toHaveLength(2);
  expect(screen.getAllByText(/12.*TTC.*10.*HT/)).toHaveLength(2);
});
it('n’affiche aucun PDF non vérifié ni lien externe non autorisé', async () => {
  http.route((req, res) => json(res, [{ ...doc, state: 'REVIEW_REQUIRED', failure: 'LEGACY_DOCUMENT_RECONCILIATION_REQUIRED' }, { ...doc, id: 2, pdfUrl: 'https://stripe.com.attacker.test' }]));
  open();expect(await screen.findByText(/Document à rapprocher/)).toBeVisible();expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('montre une erreur de chargement sans la présenter comme une liste vide', async () => {
  http.route((req, res) => json(res, { message: 'Unavailable' }, 503));open();expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
});
it('exporte seulement via la commande autorisée et conserve une erreur de refus explicite', async () => {
  http.route((req, res) => {
    if (req.path === '/api/shop/orders/8/documents') return json(res, [doc]);
    expect(req.path).toBe('/api/shop/orders/8/documents/1/export');return json(res, { message: 'Pièce inaccessible' }, 403);
  });
  open();fireEvent.click(await screen.findByRole('button', { name: /Exporter/ }));expect(await screen.findByRole('alert')).toBeVisible();
});
