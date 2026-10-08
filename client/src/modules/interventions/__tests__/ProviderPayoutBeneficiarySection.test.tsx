import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderPayoutBeneficiarySection from '../ProviderPayoutBeneficiarySection';
import { providerPayoutBeneficiaryApi, type ProviderPayoutChoice } from '../../../services/api/providerPayoutBeneficiaryApi';

vi.mock('../../../services/api/providerPayoutBeneficiaryApi', () => ({
  providerPayoutBeneficiaryApi: { choice: vi.fn(), selectOrganization: vi.fn() },
}));

const available: ProviderPayoutChoice = {
  organizationId: 9, organizationName: 'Atlas Services', selected: false, locked: false, selectedAt: null,
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ProviderPayoutBeneficiarySection missionId={11} /></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(providerPayoutBeneficiaryApi.choice).mockResolvedValue({ ...available });
});
afterEach(cleanup);

describe('Choix du bénéficiaire Baitly', () => {
  it('exige une confirmation nominative et ne présente pas la sélection comme un paiement effectué', async () => {
    vi.mocked(providerPayoutBeneficiaryApi.selectOrganization).mockResolvedValue({
      ...available, selected: true, locked: true, selectedAt: '2026-10-05T10:00:00Z',
    });
    mount();
    const button = await screen.findByRole('button', { name: 'Verser à cette organisation' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(providerPayoutBeneficiaryApi.selectOrganization).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Atlas Services/ }));
    fireEvent.click(button);
    await waitFor(() => expect(providerPayoutBeneficiaryApi.selectOrganization).toHaveBeenCalledExactlyOnceWith(11, 9));
    expect(await screen.findByRole('status')).toHaveTextContent('reste soumis aux contrôles');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('interdit de changer un bénéficiaire déjà fixé par un versement', async () => {
    vi.mocked(providerPayoutBeneficiaryApi.choice).mockResolvedValue({ ...available, locked: true });
    mount();
    expect(await screen.findByText(/bénéficiaire est déjà fixé/)).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verser à cette organisation' })).not.toBeInTheDocument();
  });

  it('ne propose aucun destinataire arbitraire pour une mission sans affectation', async () => {
    vi.mocked(providerPayoutBeneficiaryApi.choice).mockResolvedValue({ ...available, organizationId: null, organizationName: null });
    mount();
    expect(await screen.findByText(/Affectez un prestataire ou une équipe/)).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('permet de recharger une lecture en échec sans autoriser de versement', async () => {
    vi.mocked(providerPayoutBeneficiaryApi.choice).mockRejectedValueOnce(new Error('offline'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('button', { name: 'Verser à cette organisation' })).toBeDisabled();
    expect(providerPayoutBeneficiaryApi.selectOrganization).not.toHaveBeenCalled();
  });

  it('recharge la décision après une erreur de confirmation et exige un nouvel accord', async () => {
    vi.mocked(providerPayoutBeneficiaryApi.selectOrganization).mockRejectedValue(new Error('network response lost'));
    mount();
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Verser à cette organisation' }));
    expect(await screen.findByText(/choix n’a pas pu être confirmé/)).toBeVisible();
    await waitFor(() => expect(providerPayoutBeneficiaryApi.choice).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Verser à cette organisation' })).toBeDisabled();
  });

  it('ne reporte pas une confirmation sur une nouvelle organisation après réaffectation', async () => {
    const client = mount();
    fireEvent.click(await screen.findByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Verser à cette organisation' })).toBeEnabled();
    await act(async () => {
      client.setQueryData(['provider-payout-beneficiary', 11], { ...available, organizationId: 10, organizationName: 'Riad Maintenance' });
    });
    expect(await screen.findByRole('checkbox', { name: /Riad Maintenance/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Verser à cette organisation' })).toBeDisabled();
  });
});
