vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => context.scope }));
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyCommerceOperationsPanel from './BaitlyCommerceOperationsPanel';
const context = vi.hoisted(() => ({ origin: '', scope: 'test:2' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => { cleanup();context.scope = 'test:2';expect(http.unexpected).toEqual([]); });
function open(canEdit = true, source = 'UPSELL', canRestock = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<BaitlyCommerceOperationsPanel source={source} sourceId={8} canEdit={canEdit} canRestock={canRestock} />, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}
it('garde la preuve et l’identifiant d’action lors d’une relance réseau', async () => {
  const sent: unknown[] = [];http.route((req, res) => { if (req.method === 'GET') return json(res, []);sent.push(JSON.parse(req.body));return json(res, { message: 'Réponse perdue' }, 503); });
  open();fireEvent.change(await screen.findByLabelText('Prochaine étape'), { target: { value: 'FULFILLED' } });
  fireEvent.change(screen.getByLabelText('Référence justificative ou de suivi'), { target: { value: 'SERVICE-8' } });
  const save = screen.getByRole('button', { name: 'Enregistrer' });fireEvent.click(save);fireEvent.click(save);await screen.findByRole('alert');expect(sent).toHaveLength(1);
  fireEvent.click(save);await waitFor(() => expect(sent).toHaveLength(2));expect(sent[0]).toEqual(sent[1]);expect(sent[0]).toMatchObject({ source: 'UPSELL', sourceId: 8, action: 'FULFILLED', proof: 'SERVICE-8' });
});
it('ne permet pas de réaliser une prestation annulée et conserve sa preuve', async () => {
  http.route((req, res) => json(res, [{ id: 2, action: 'CANCELLED', proof: 'CANCEL-8', note: 'Demande voyageur', createdAt: '2026-01-01T10:00:00Z' }]));
  open();expect(await screen.findByText('Annulé')).toBeVisible();expect(screen.getByText('Demande voyageur')).toBeVisible();expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
});

it('affiche une validation confirmée sans relire ni renvoyer la commande', async () => {
  let reads = 0, writes = 0;
  http.route((req, res) => {
    if (req.method === 'GET') { reads++;return reads === 1 ? json(res, []) : json(res, { message: 'Relecture indisponible' }, 503); }
    writes++;return json(res, { id: 3, action: 'FULFILLED', proof: 'PARKING-TEST', note: 'Place fictive mise à disposition', createdAt: '2026-10-19T10:00:00Z' });
  });
  open();fireEvent.change(await screen.findByLabelText('Prochaine étape'), { target: { value: 'FULFILLED' } });
  fireEvent.change(screen.getByLabelText('Référence justificative ou de suivi'), { target: { value: 'PARKING-TEST' } });
  const save = screen.getByRole('button', { name: 'Enregistrer' });fireEvent.click(save);fireEvent.click(save);
  expect(await screen.findByText('Place fictive mise à disposition')).toBeVisible();
  expect(screen.getByText('Réalisé')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  expect(writes).toBe(1);expect(reads).toBe(1);
});

it('permet la lecture sans exposer de formulaire ou envoyer une action', async () => {
  let writes = 0;
  http.route((req, res) => {
    if (req.method !== 'GET') writes++;
    return json(res, [{ id: 4, action: 'SCHEDULED', proof: 'ARRIVEE-TEST', note: 'Arrivée anticipée confirmée, données fictives', createdAt: '2026-10-19T10:00:00Z' }]);
  });
  open(false);
  expect(await screen.findByText('Planifié')).toBeVisible();
  expect(screen.getByText('Arrivée anticipée confirmée, données fictives')).toBeVisible();
  expect(screen.queryByLabelText('Prochaine étape')).toBeNull();
  expect(writes).toBe(0);
});

it('masque le formulaire obsolète si une actualisation échoue puis relit l’annulation', async () => {
  let reads = 0;
  http.route((_req, res) => {
    reads++;
    if (reads === 2) return json(res, { message: 'Historique indisponible' }, 503);
    return json(res, reads === 1 ? [] : [{ id: 5, action: 'CANCELLED', proof: 'ANNULATION-TEST', note: 'Annulation fictive', createdAt: '2026-10-19T10:00:00Z' }]);
  });
  open();await screen.findByLabelText('Prochaine étape');
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser l’historique' }));
  await screen.findByRole('alert');expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser l’historique' }));
  expect(await screen.findByText('Annulé')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
});

it('ne réutilise pas les justificatifs ou notes d’une autre vente ou organisation', async () => {
  http.route((_req, res) => json(res, []));
  const page = open();await screen.findByLabelText('Prochaine étape');
  fireEvent.change(screen.getByLabelText('Référence justificative ou de suivi'), { target: { value: 'PREUVE-A' } });
  fireEvent.change(screen.getByLabelText('Précisions'), { target: { value: 'Note de la vente A' } });
  page.rerender(<BaitlyCommerceOperationsPanel source="UPSELL" sourceId={9} canEdit />);
  expect(await screen.findByLabelText('Référence justificative ou de suivi')).toHaveValue('');
  expect(screen.getByLabelText('Précisions')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Référence justificative ou de suivi'), { target: { value: 'PREUVE-B' } });
  context.scope = 'test:3';
  page.rerender(<BaitlyCommerceOperationsPanel source="UPSELL" sourceId={9} canEdit />);
  expect(await screen.findByLabelText('Référence justificative ou de suivi')).toHaveValue('');
});

it('conserve le parcours matériel partagé sans lui proposer les étapes d’un service', async () => {
  const sent: Record<string, unknown>[] = [];
  http.route((req, res) => {
    if (req.method === 'GET') return json(res, []);
    const body = JSON.parse(req.body);sent.push(body);
    return json(res, { id: 6, action: body.action, proof: body.proof, note: body.note, createdAt: '2026-10-19T10:00:00Z' });
  });
  open(true, 'HARDWARE_ORDER');
  const next = await screen.findByLabelText('Prochaine étape');
  expect(next).toHaveValue('PREPARING');
  expect(screen.queryByRole('option', { name: 'Réalisé' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Référence justificative ou de suivi'), { target: { value: 'MATERIEL-TEST' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await screen.findByText('En préparation', { selector: 'p' });
  expect(sent).toHaveLength(1);expect(sent[0]).toMatchObject({ source: 'HARDWARE_ORDER', action: 'PREPARING' });
  expect(screen.getByLabelText('Prochaine étape')).toHaveValue('SHIPPED');
});

it('réintègre un retour de matériel une seule fois avec son justificatif', async () => {
  let writes = 0;
  http.route((req, res) => {
    if (req.method === 'GET') return json(res, [{ id: 7, action: 'RETURNED', proof: 'RETOUR-TEST', note: '', createdAt: '2026-10-19T10:00:00Z' }]);
    writes++;return json(res, {});
  });
  open(false, 'HARDWARE_ORDER', true);
  fireEvent.change(await screen.findByLabelText('Justificatif du contrôle physique'), { target: { value: 'CONTROLE-FICTIF' } });
  const button = screen.getByRole('button', { name: 'Réintégrer les articles contrôlés au stock' });fireEvent.click(button);fireEvent.click(button);
  await screen.findByRole('status');expect(writes).toBe(1);
  expect(screen.queryByRole('button', { name: 'Réintégrer les articles contrôlés au stock' })).toBeNull();
});
