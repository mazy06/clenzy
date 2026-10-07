vi.mock('../../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'test:2' }));
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyAffiliateAdjustments from './BaitlyAffiliateAdjustments';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
const row = { id: 7, provider: 'VIATOR', externalBookingId: 'VT-7', grossCommission: 100, hostShare: 80, platformShare: 20, currency: 'EUR', propertyId: 3, status: 'RECEIVED' as const, receiptReference: 'BANK-7', receivedAt: '2026-01-01' };
function open(canEdit = true) { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlyAffiliateAdjustments row={row} canEdit={canEdit} onSaved={async () => {}} /></QueryClientProvider>); }
it('transmet le montant attendu et garde la clé de correction après un échec réseau', async () => {
  const sent: unknown[] = [];http.route((req, res) => { if (req.path.startsWith('/api/commerce/payouts')) return json(res, { currency: 'EUR', ownerAvailable: 80, conciergeAvailable: 0, transfers: [], recoveries: [] });if (req.method === 'GET') return json(res, []);sent.push(JSON.parse(req.body));return json(res, { message: 'Réponse perdue' }, 503); });
  open();fireEvent.click(await screen.findByRole('button', { name: 'Corriger le montant' }));
  fireEvent.change(screen.getByLabelText('Nouveau montant de commission (EUR)'), { target: { value: '70' } });
  fireEvent.change(screen.getByLabelText(/justificatif/i), { target: { value: 'BANK-correction' } });
  fireEvent.change(screen.getByLabelText('Motif de la correction'), { target: { value: 'Remboursement partenaire' } });
  const save = screen.getByRole('button', { name: 'Enregistrer' });fireEvent.click(save);fireEvent.click(save);await screen.findByRole('alert');expect(sent).toHaveLength(1);
  fireEvent.click(save);await waitFor(() => expect(sent).toHaveLength(2));expect(sent[0]).toEqual(sent[1]);expect(sent[0]).toMatchObject({ expectedGross: 100, gross: 70, currency: 'EUR' });
});
it('rend les preuves historiques au lecteur sans action de modification', async () => {
  http.route((req, res) => json(res, [{ id: 1, beforeGross: 120, afterGross: 100, reason: 'Correction partenaire', proof: 'BANK-original', createdAt: '2026-01-01T00:00:00Z' }]));
  open(false);expect(await screen.findByText('Correction partenaire')).toBeVisible();expect(screen.queryByRole('button')).toBeNull();
});
