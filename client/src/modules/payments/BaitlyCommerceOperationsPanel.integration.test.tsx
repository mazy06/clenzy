vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => 'test:2' }));
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyCommerceOperationsPanel from './BaitlyCommerceOperationsPanel';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => { cleanup();expect(http.unexpected).toEqual([]); });
function open(canEdit = true) { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BaitlyCommerceOperationsPanel source="UPSELL" sourceId={8} canEdit={canEdit} /></QueryClientProvider>); }
it('garde la preuve et l’identifiant d’action lors d’une relance réseau', async () => {
  const sent: unknown[] = [];http.route((req, res) => { if (req.method === 'GET') return json(res, []);sent.push(JSON.parse(req.body));return json(res, { message: 'Réponse perdue' }, 503); });
  open();fireEvent.change(await screen.findByLabelText('Prochaine étape'), { target: { value: 'FULFILLED' } });
  fireEvent.change(screen.getByLabelText('Référence justificative ou de suivi'), { target: { value: 'SERVICE-8' } });
  const save = screen.getByRole('button', { name: 'Enregistrer' });fireEvent.click(save);fireEvent.click(save);await screen.findByRole('alert');expect(sent).toHaveLength(1);
  fireEvent.click(save);await waitFor(() => expect(sent).toHaveLength(2));expect(sent[0]).toEqual(sent[1]);expect(sent[0]).toMatchObject({ source: 'UPSELL', sourceId: 8, action: 'FULFILLED', proof: 'SERVICE-8' });
});
it('ne permet pas de réaliser une prestation annulée et conserve sa preuve', async () => {
  http.route((req, res) => json(res, [{ id: 2, action: 'CANCELLED', proof: 'CANCEL-8', note: 'Demande voyageur', createdAt: '2026-01-01T10:00:00Z' }]));
  open();expect(await screen.findByText('Annulé')).toBeVisible();expect(screen.getByText('Demande voyageur')).toBeVisible();expect(screen.queryByRole('button')).toBeNull();
});
