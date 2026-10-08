import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import AiCreditsSection from './AiCreditsSection';

// Le composant, son API et le client HTTP restent réels ; aucune clé ni requête Stripe.
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('./AgentRunReplayDialog', () => ({ default: () => null }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
afterEach(() => { cleanup(); expect(http.unexpected).toEqual([]); });
const pack = { key: 'pack_500', millicredits: 500000, priceCents: 1200, label: '500 crédits IA' };
const mount = (path = '/') => render(<MemoryRouter initialEntries={[path]}><AiCreditsSection /></MemoryRouter>);

it('présente les réservations et la régularisation séparément du solde disponible', async () => {
  http.route((req, res) => {
    if (req.path.endsWith('/balance')) return json(res, { totalMillicredits: 0, reservedMillicredits: 3000, debtMillicredits: 150000, pockets: [] });
    if (req.path.endsWith('/packs')) return json(res, [pack]);
    if (req.path.endsWith('/ledger')) return json(res, [{ createdAt: '2026-10-07T08:00:00Z', entryType: 'ADJUSTMENT', agent: 'billing', model: null, feature: 'CREDITS', millicredits: -250000, runId: null }]);
    throw new Error('Route inattendue');
  });
  mount('/?topup=success');
  expect(await screen.findByText(/150 crédits à régulariser/)).toHaveTextContent('Aucun paiement automatique');
  expect(screen.getByRole('status')).toHaveTextContent('3 crédits réservés');
  expect(screen.getByText(/Retour du paiement/)).toHaveTextContent('après confirmation');
  expect(http.requests.every(r => r.method === 'GET')).toBe(true);
});

it('ne présente pas un solde nul ni de bouton d’achat en cas d’échec du chargement', async () => {
  let failed = true;
  http.route((req, res) => {
    if (req.path.endsWith('/balance')) return failed ? json(res, { message: 'Indisponible' }, 503) : json(res, { totalMillicredits: 100000, pockets: [] });
    if (req.path.endsWith('/packs')) return json(res, [pack]);
    if (req.path.endsWith('/ledger')) return json(res, []);
    throw new Error('Route inattendue');
  });
  mount();
  const retry = await screen.findByRole('button', { name: /Réessayer/ });
  expect(screen.queryByText('Crédits IA disponibles')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /500 crédits/ })).not.toBeInTheDocument();
  failed = false; fireEvent.click(retry);
  expect(await screen.findByText('100')).toBeVisible();
});

it('bloque les doubles clics, conserve la tentative après erreur et refuse une redirection étrangère', async () => {
  let release!: () => void;
  let posts = 0;
  const bodies: Array<{ pack: string; requestId: string }> = [];
  http.route(async (req, res) => {
    if (req.path.endsWith('/balance')) return json(res, { totalMillicredits: 0, pockets: [] });
    if (req.path.endsWith('/packs')) return json(res, [pack]);
    if (req.path.endsWith('/ledger')) return json(res, []);
    if (req.method === 'POST' && req.path.endsWith('/topup')) {
      bodies.push(JSON.parse(req.body)); posts++;
      if (posts === 1) { await new Promise<void>(resolve => { release = resolve; }); return json(res, { message: 'Réponse perdue' }, 503); }
      return json(res, { checkoutUrl: 'https://checkout.stripe.com.evil.invalid/pay' });
    }
    throw new Error('Route inattendue');
  });
  mount(); const buy = await screen.findByRole('button', { name: /500 crédits/ });
  fireEvent.click(buy); fireEvent.click(buy);
  await waitFor(() => expect(posts).toBe(1)); expect(buy).toBeDisabled(); release();
  await waitFor(() => expect(buy).toBeEnabled()); fireEvent.click(buy);
  await waitFor(() => expect(posts).toBe(2)); await waitFor(() => expect(buy).toBeEnabled());
  expect(bodies[1]).toEqual(bodies[0]); expect(bodies[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(await screen.findByText(/Impossible de créer la session/)).toBeVisible();
});
