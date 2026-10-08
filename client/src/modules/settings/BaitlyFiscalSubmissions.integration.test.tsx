vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'staff:2' }));
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyFiscalSubmissions from './BaitlyFiscalSubmissions';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlyFiscalSubmissions country="FR" /></QueryClientProvider>); }
it('distingue l’attente de raccordement d’une réception confirmée et filtre le pays', async () => {
  http.route((req, res) => { expect(req.path).toBe('/api/fiscal-profile/submissions');return json(res, [
    { id: 1, invoiceNumber: 'FR-1', country: 'FR', status: 'PENDING', message: 'Partenaire non configuré' },
    { id: 2, invoiceNumber: 'FR-2', country: 'FR', status: 'REPORTED', reference: 'ACK-2' },
    { id: 3, invoiceNumber: 'MA-3', country: 'MA', status: 'PENDING' },
  ]); });
  open();expect(await screen.findByText('FR-1')).toBeVisible();expect(screen.getByText('En attente de raccordement ou de confirmation')).toBeVisible();
  expect(screen.getByText('Transmission confirmée')).toBeVisible();expect(screen.getByText(/ACK-2/)).toBeVisible();expect(screen.queryByText('MA-3')).not.toBeInTheDocument();
});
it('un dépôt identifié reste en attente et un refus conserve sa référence partenaire', async () => {
  http.route((req, res) => json(res, [
    { id: 4, invoiceNumber: 'FR-4', country: 'FR', status: 'PENDING', reference: 'iopole:SANDBOX:customer:pending', message: 'Facture déposée ; transmission à confirmer' },
    { id: 5, invoiceNumber: 'FR-5', country: 'FR', status: 'FAILED', reference: 'iopole:SANDBOX:customer:rejected', message: 'Document refusé ; correction fiscale requise' },
  ]));
  open();expect(await screen.findByText('FR-4')).toBeVisible();
  expect(screen.getByText('En attente de raccordement ou de confirmation')).toBeVisible();
  expect(screen.getByText('À rapprocher')).toBeVisible();
  expect(screen.getByText(/Référence partenaire : iopole:SANDBOX:customer:pending/)).toBeVisible();
  expect(screen.getByText(/Référence partenaire : iopole:SANDBOX:customer:rejected/)).toBeVisible();
  expect(screen.queryByText('Transmission confirmée')).not.toBeInTheDocument();
});
it('ne présente jamais une erreur réseau comme une exemption fiscale', async () => {
  http.route((req, res) => json(res, { message: 'Unavailable' }, 503));open();
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible');expect(screen.queryByText('Transmission non requise')).not.toBeInTheDocument();
});
