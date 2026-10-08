import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayoutsTab } from '../AccountingPage';
import { accountingApi, type OwnerPayout, type OwnerPayoutConfig } from '../../../services/api/accountingApi';

vi.mock('../../../services/api/accountingApi', async (original) => ({
  ...await original<typeof import('../../../services/api/accountingApi')>(),
  accountingApi: {
    getPayouts: vi.fn(), getAllOwnerPayoutConfigs: vi.fn(), approvePayout: vi.fn(), executePayout: vi.fn(), retryPayout: vi.fn(),
  },
}));
vi.mock('../../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: () => null }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasRole: () => true }) }));
// Une préférence de conversion EUR ne doit jamais réécrire le montant du virement.
vi.mock('../../../hooks/useCurrency', () => ({
  useCurrency: () => ({ currency: 'EUR', convert: (amount: number) => amount / 10 }),
}));
vi.mock('../../../components/Money', () => ({
  Money: ({ value }: { value: number }) => <span>{value / 10} €</span>,
}));

const payout = (currency: string): OwnerPayout => ({
  id: 31, ownerId: 10, ownerName: 'Nadia Martin', periodStart: '2025-09-01', periodEnd: '2025-09-30',
  grossRevenue: 100, commissionAmount: 15, commissionRate: 0.15, otaFees: 5, expenses: 0,
  netAmount: 80, status: 'PENDING', generationType: 'AUTO', payoutMethod: null,
  stripeTransferId: null, paymentReference: null, paidAt: null, failureReason: null,
  retryCount: 0, notes: null, createdAt: '2025-10-01T10:00:00Z', currency, fundingVersion: 1,
});
const clients: QueryClient[] = [];
const readyConfig = { ownerId: 10, payoutMethod: 'STRIPE_CONNECT', stripeConnectedAccountId: 'acct_test', stripeOnboardingComplete: true, verified: true } as OwnerPayoutConfig;
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const view = render(<MemoryRouter><QueryClientProvider client={client}><PayoutsTab /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Nadia Martin/ }));
  return view;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([]);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('Montants et validation des reversements', () => {
  it.each(['MAD', 'SAR'])('conserve les montants en %s dans la liste et le détail avant approbation', async (currency) => {
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([payout(currency)]);
    await mount();
    const row = await screen.findByRole('button', { name: /Nadia Martin/ });
    expect(within(screen.getByRole('region', { name: 'Détails' })).getByText(new RegExp(`100.*${currency}`))).toBeVisible();
    expect(within(row).getByText(new RegExp(`80.*${currency}`))).toBeVisible();
    expect(within(row).queryByText(/€/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir le détail' }));
    const detail = screen.getByRole('region', { name: 'Détails' });
    const otaFees = within(detail).getByText('Frais OTA').parentElement!;
    expect(otaFees).toHaveTextContent(new RegExp(`5.*${currency}`));
    expect(within(detail).getAllByText(new RegExp(`80.*${currency}`))[0]).toBeVisible();
  });

  it('explique le rapprochement requis quand le serveur refuse une approbation', async () => {
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([payout('EUR')]);
    vi.mocked(accountingApi.approvePayout).mockRejectedValue(new Error('Encaissements à rapprocher avant paiement.'));
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Encaissements à rapprocher avant paiement.');
    expect(accountingApi.approvePayout).toHaveBeenCalledWith(31);
  });

  it('confirme uniquement le montant après approbation, sans lancer un transfert', async () => {
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([payout('EUR')]);
    vi.mocked(accountingApi.approvePayout).mockResolvedValue({ ...payout('EUR'), status: 'APPROVED' });
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Montant approuvé. Aucun versement n’a été lancé.');
    expect(accountingApi.executePayout).not.toHaveBeenCalled();
    expect(accountingApi.retryPayout).not.toHaveBeenCalled();
  });

  it('propose uniquement le versement PSP pour un bénéficiaire prêt', async () => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([readyConfig]);
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), status: 'APPROVED' }]);
    await mount();
    expect(await screen.findByRole('button', { name: 'Verser via Stripe' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Marquer.*payé|SEPA XML/i })).not.toBeInTheDocument();
  });

  it('demande un PSP sans proposer un virement manuel lorsque le compte manque', async () => {
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), status: 'APPROVED' }]);
    await mount();
    expect(await screen.findByRole('button', { name: 'Configurer le PSP' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Verser via Stripe' })).not.toBeInTheDocument();
    expect(accountingApi.executePayout).not.toHaveBeenCalled();
  });

  it('ne réexécute pas un ancien rail SEPA, même avec un compte Stripe désormais prêt', async () => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([readyConfig]);
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), status: 'FAILED', payoutMethod: 'SEPA_TRANSFER' }]);
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Ancienne méthode · consultation' }));
    expect(within(screen.getByRole('region', { name: 'Détails' })).getByText('Ancienne méthode · consultation')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Réessayer le versement|SEPA XML|Marquer.*payé/i })).not.toBeInTheDocument();
    expect(accountingApi.retryPayout).not.toHaveBeenCalled();
  });

  it('ne propose pas de versement pour un historique sans preuve de financement', async () => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([readyConfig]);
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), status: 'APPROVED', fundingVersion: 0 }]);
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier les encaissements' }));
    expect(within(screen.getByRole('region', { name: 'Détails' })).getByText(/Ce reversement historique n’est pas relié/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Verser via Stripe' })).not.toBeInTheDocument();
    expect(accountingApi.executePayout).not.toHaveBeenCalled();
  });

  it('ne propose plus l’approbation d’un ancien calcul sans justificatifs', async () => {
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), fundingVersion: 0 }]);
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier les encaissements' }));
    expect(within(screen.getByRole('region', { name: 'Détails' })).getByText(/ne permet aucun envoi au PSP/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approuver' })).not.toBeInTheDocument();
    expect(accountingApi.approvePayout).not.toHaveBeenCalled();
  });

  it('conserve un historique approuvé comme non transféré', async () => {
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), status: 'APPROVED', fundingVersion: 0 }]);
    await mount();
    const row = await screen.findByRole('button', { name: /Nadia Martin/ });
    expect(row).toHaveTextContent('Approuvé');
    expect(row).toHaveTextContent('Historique à vérifier');
    expect(within(row).queryByRole('button', { name: 'Suivre' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Verser via Stripe' })).not.toBeInTheDocument();
  });

  it.each([
    { status: 'PAID', payoutMethod: 'MANUAL', label: 'Payé (historique)', tracks: false },
    { status: 'PAID', payoutMethod: 'STRIPE_CONNECT', label: 'Transféré au PSP', tracks: true },
  ] as const)('distingue un paiement $payoutMethod du suivi PSP', async ({ status, payoutMethod, label, tracks }) => {
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), status, payoutMethod }]);
    await mount();
    const row = await screen.findByRole('button', { name: /Nadia Martin/ });
    expect(row).toHaveTextContent(label);
    expect(within(screen.getByRole('region', { name: 'Détails' })).queryByRole('button', { name: 'Suivre' }) !== null).toBe(tracks);
  });

  it.each([
    { status: 'FAILED', retryCount: 3 },
    { status: 'FAILED', stripeTransferId: 'tr_existing' },
    { status: 'APPROVED', netAmount: 0 },
  ] as const)('explique le blocage sans proposer un nouvel envoi : %j', async overrides => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([readyConfig]);
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([{ ...payout('EUR'), payoutMethod: 'STRIPE_CONNECT', ...overrides }]);
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Comprendre le blocage' }));
    expect(screen.getByRole('region', { name: 'Détails' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Réessayer le versement|Verser via Stripe/ })).not.toBeInTheDocument();
    expect(accountingApi.executePayout).not.toHaveBeenCalled();
    expect(accountingApi.retryPayout).not.toHaveBeenCalled();
  });

  it.each(['execute', 'retry'] as const)('affiche l’échec métier renvoyé avec HTTP 200 après %s', async action => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([readyConfig]);
    const current = { ...payout('EUR'), status: action === 'retry' ? 'FAILED' : 'APPROVED', payoutMethod: 'STRIPE_CONNECT' } as OwnerPayout;
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([current]);
    const failed = { ...current, status: 'FAILED', failureReason: 'Solde Stripe disponible insuffisant.' } as OwnerPayout;
    vi.mocked(action === 'retry' ? accountingApi.retryPayout : accountingApi.executePayout).mockResolvedValue(failed);
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: action === 'retry' ? 'Réessayer le versement' : 'Verser via Stripe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solde Stripe disponible insuffisant.');
    expect(screen.queryByText(/Transfert confirmé|avec succès/)).not.toBeInTheDocument();
  });

  it('ne transforme pas une demande en cours en confirmation de transfert', async () => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([readyConfig]);
    const current = { ...payout('EUR'), status: 'APPROVED' } as OwnerPayout;
    vi.mocked(accountingApi.getPayouts).mockResolvedValue([current]);
    vi.mocked(accountingApi.executePayout).mockResolvedValue({ ...current, status: 'PROCESSING' });
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Verser via Stripe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La confirmation est en cours.');
    expect(screen.queryByText(/Transfert confirmé/)).not.toBeInTheDocument();
  });
});
