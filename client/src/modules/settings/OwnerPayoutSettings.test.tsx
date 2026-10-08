import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerPayoutSettings from './OwnerPayoutSettings';
import { accountingApi, type OwnerPayoutConfig } from '../../services/api/accountingApi';
import { usersApi } from '../../services/api/usersApi';

vi.mock('../../services/api/accountingApi', () => ({ accountingApi: { getAllOwnerPayoutConfigs: vi.fn(), updatePayoutMethod: vi.fn() } }));
vi.mock('../../services/api/usersApi', () => ({ usersApi: { getAll: vi.fn() } }));
const clients: QueryClient[] = [];
const config = { id: 1, ownerId: 10, payoutMethod: 'SEPA_TRANSFER', verified: true, stripeConnectedAccountId: null, stripeOnboardingComplete: false } as OwnerPayoutConfig;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><OwnerPayoutSettings /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(usersApi.getAll).mockResolvedValue([]); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('Configuration des bénéficiaires PSP', () => {
  it('ne confond pas un IBAN vérifié avec un compte Stripe connecté', async () => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([config]);
    mount();
    expect(await screen.findByText('Configuration à terminer')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Utiliser Stripe|Modifier SEPA|Vérifier|Changer la méthode/ })).not.toBeInTheDocument();
    expect(accountingApi.updatePayoutMethod).not.toHaveBeenCalled();
  });

  it('active uniquement le PSP déjà connecté sans ressaisir ni valider un IBAN', async () => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([{ ...config, stripeConnectedAccountId: 'acct_test', stripeOnboardingComplete: true }]);
    vi.mocked(accountingApi.updatePayoutMethod).mockResolvedValue({ ...config, payoutMethod: 'STRIPE_CONNECT' });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser Stripe' }));
    await waitFor(() => expect(accountingApi.updatePayoutMethod).toHaveBeenCalledExactlyOnceWith(10, { payoutMethod: 'STRIPE_CONNECT' }));
    expect(screen.queryByRole('textbox', { name: 'IBAN' })).not.toBeInTheDocument();
  });

  it('affiche le refus serveur sans annoncer une activation', async () => {
    vi.mocked(accountingApi.getAllOwnerPayoutConfigs).mockResolvedValue([{ ...config, stripeConnectedAccountId: 'acct_test', stripeOnboardingComplete: true }]);
    vi.mocked(accountingApi.updatePayoutMethod).mockRejectedValue(new Error('Compte non autorisé.'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser Stripe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Compte non autorisé.');
    expect(screen.queryByText('Prêt pour les versements')).not.toBeInTheDocument();
  });
});
