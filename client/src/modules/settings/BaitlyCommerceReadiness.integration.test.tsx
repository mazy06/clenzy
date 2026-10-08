import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import BaitlyCommerceReadiness, { useCommerceReadiness, type CommerceReadinessReport } from './BaitlyCommerceReadiness';

const context = vi.hoisted(() => ({ origin: '', scope: 'staff:7' }));
vi.mock('../../hooks/useCommerceScope', () => ({ useCommerceScope: () => context.scope }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));

const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
afterEach(() => { cleanup(); context.scope = 'staff:7'; expect(http.unexpected).toEqual([]); });

function report(remote = false): CommerceReadinessReport {
  return {
    checkedAt: '2026-10-07T12:00:00Z', remoteVerification: remote,
    providers: [{ provider: 'STRIPE', settingsPresent: remote, implemented: true }],
    countries: [
      { country: 'FR', checks: [
        { key: 'platformKey', state: 'CONFIGURED' },
        { key: 'sellerAccount', state: remote ? 'CONFIGURED' : 'NOT_CHECKED' },
        { key: 'taxSettings', state: remote ? 'MISSING' : 'NOT_CHECKED' },
        { key: 'eInvoicing', state: 'MISSING' },
      ] },
      { country: 'MA', checks: [{ key: 'localPlatform', state: 'NOT_CONNECTED' }] },
      { country: 'SA', checks: [{ key: 'localPlatform', state: 'NOT_CONNECTED' }] },
    ],
  };
}
function Content() {
  const diagnostic = useCommerceReadiness();
  return <><BaitlyCommerceReadiness diagnostic={diagnostic} />
    <output aria-label="Configuration fournisseur">{diagnostic.report?.providers[0]?.settingsPresent ? 'présente' : 'non confirmée'}</output>
  </>;
}
function open(client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  const wrapper = <QueryClientProvider client={client}><Content /></QueryClientProvider>;
  return { ...render(wrapper), wrapper, client };
}

it('charge la configuration locale sans appel PSP et sépare les trois sociétés', async () => {
  http.route((req, res) => {
    expect(req.method).toBe('GET'); expect(req.path).toBe('/api/payment-configs/diagnostic'); json(res, report());
  });
  open();
  expect(await screen.findByText('Compte de la société française')).toBeVisible();
  expect(screen.getAllByText('Non vérifié')).toHaveLength(2);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Maroc' }));
  expect(screen.getByText('PSP de la société locale')).toBeVisible();
  expect(screen.queryByText('Compte de la société française')).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Arabie saoudite' }));
  expect(screen.getByText('À raccorder')).toBeVisible();
  expect(http.requests).toHaveLength(1);
});

it('ne contacte Stripe que sur demande et affiche un blocage fiscal sans annoncer le circuit prêt', async () => {
  http.route((req, res) => {
    expect(req.method).toBe('GET');
    expect(['/api/payment-configs/diagnostic', '/api/payment-configs/diagnostic?verify=true']).toContain(req.path);
    json(res, report(req.path.endsWith('true')));
  });
  open(); await screen.findByText('Compte de la société française');
  expect(screen.getByLabelText('Configuration fournisseur')).toHaveTextContent('non confirmée');
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier auprès de Stripe' }));
  await waitFor(() => expect(screen.getByLabelText('Configuration fournisseur')).toHaveTextContent('présente'));
  const checks = screen.getByLabelText('Prérequis de configuration');
  expect(within(checks).getAllByText('À compléter')).toHaveLength(2);
  expect(screen.getByText(/compte Stripe France uniquement/)).toBeVisible();
  expect(http.requests.map(req => req.path)).toEqual(['/api/payment-configs/diagnostic', '/api/payment-configs/diagnostic?verify=true']);
});

it('retire les résultats précédents après une erreur de vérification et permet de relire la configuration', async () => {
  let fail = false;
  http.route((req, res) => {
    if (req.path.endsWith('true') && fail) json(res, { message: 'unavailable' }, 503);
    else json(res, report(req.path.endsWith('true')));
  });
  open(); await screen.findByText('Compte de la société française');
  const verify = screen.getByRole('button', { name: 'Vérifier auprès de Stripe' });
  fireEvent.click(verify);
  await waitFor(() => expect(screen.getByLabelText('Configuration fournisseur')).toHaveTextContent('présente'));
  fail = true; fireEvent.click(verify);
  expect(await screen.findByRole('alert')).toHaveTextContent('Diagnostic indisponible');
  expect(screen.queryByLabelText('Prérequis de configuration')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Configuration fournisseur')).toHaveTextContent('non confirmée');
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
  expect(await screen.findByText('Compte de la société française')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('ne réutilise pas la configuration fournisseur après un changement d’organisation', async () => {
  http.route((req, res) => json(res, context.scope === 'staff:7' ? report(true) : { message: 'forbidden' }, context.scope === 'staff:7' ? 200 : 403));
  const view = open();
  await waitFor(() => expect(screen.getByLabelText('Configuration fournisseur')).toHaveTextContent('présente'));
  context.scope = 'staff:8'; view.rerender(<QueryClientProvider client={view.client}><Content /></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByLabelText('Prérequis de configuration')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Configuration fournisseur')).toHaveTextContent('non confirmée');
});
