import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyPayoutTransfers from './MyPayoutTransfers';
import { myPayoutTransfersApi, type MyTransfer } from '../../../services/api/myPayoutTransfersApi';
import { paymentConnectApi, redirectToPaymentProvider, type PaymentConnectionStatus } from '../../../services/api/paymentConnectApi';
import fr from '../../../../public/locales/fr.json';

vi.mock('../../../services/api/myPayoutTransfersApi', () => ({ myPayoutTransfersApi: { list: vi.fn(), detail: vi.fn() } }));
vi.mock('../../../services/api/paymentConnectApi', () => ({ paymentConnectApi: { status: vi.fn(), start: vi.fn(), refresh: vi.fn() }, redirectToPaymentProvider: vi.fn() }));
vi.mock('../../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: (node: React.ReactNode) => node }));
const auth = vi.hoisted(() => ({ user: { id: 42, organizationId: 9 } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth }));
const row: MyTransfer = { id: 1, source: 'INTERVENTION', amount: 80, currency: 'EUR', state: 'TRANSFERRED',
  description: 'Maintenance de la Villa Atlas', createdAt: '2026-10-05T08:00:00Z', updatedAt: '2026-10-05T08:01:00Z' };
const initial: PaymentConnectionStatus = { scope: 'PERSONAL', country: 'FR', accountCreated: false, ready: false,
  payoutsEnabled: false, chargesEnabled: false, transfersEnabled: false, canManageOrganization: false,
  creationAvailable: true, connectionAvailable: true, reconnectRequired: false };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><MyPayoutTransfers /></QueryClientProvider>);
  return { ...view, client };
}
beforeEach(() => {
  vi.resetAllMocks(); auth.user.id = 42; auth.user.organizationId = 9;
  window.history.replaceState({}, '', '/account?tab=my-transfers');
  vi.mocked(paymentConnectApi.status).mockImplementation(async (scope) => ({ ...initial, scope }));
  vi.mocked(myPayoutTransfersApi.list).mockResolvedValue({ content: [row], totalPages: 1, totalElements: 1 });
  vi.mocked(myPayoutTransfersApi.detail).mockResolvedValue({ transfer: row, events: [{ state: 'TRANSFERRED', createdAt: row.updatedAt }], bankPayouts: [] });
});
afterEach(cleanup);

describe('Mes versements bénéficiaire', () => {
  it('distingue le compte Connect de la banque sans proposer de rapprochement ou de paiement', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Maintenance de la Villa Atlas/ }));
    expect(await screen.findByText(/réception en banque n’est pas confirmée/)).toBeVisible();
    expect(screen.getByText(fr.myTransfers.advice.TRANSFERRED)).toBeVisible();
    expect(screen.queryByLabelText('Référence Stripe')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(paymentConnectApi.start).not.toHaveBeenCalled();
  });
  it('affiche l’échec bancaire reçu du serveur sans le transformer en succès', async () => {
    vi.mocked(myPayoutTransfersApi.detail).mockResolvedValue({ transfer: row, events: [], bankPayouts: [
      { payoutId: 'po_failed', status: 'FAILED', estimatedArrival: null, failureCode: 'account_closed', eventCreated: row.updatedAt },
    ] });
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Maintenance de la Villa Atlas/ }));
    expect(await screen.findByText(fr.myTransfers.bankFailed)).toBeVisible();
    expect(screen.getByText(fr.payoutTracking.bankStates.FAILED)).toBeVisible();
    expect(screen.queryByText('account_closed')).not.toBeInTheDocument();
  });
  it('refuse un scope société forgé dans l’URL avant toute requête de son historique', async () => {
    window.history.replaceState({}, '', '/account?tab=my-transfers&paymentScope=ORGANIZATION');
    mount(); expect(await screen.findByText(fr.myTransfers.organizationDenied)).toBeVisible();
    expect(myPayoutTransfersApi.list).not.toHaveBeenCalled();
    expect(paymentConnectApi.status).not.toHaveBeenCalledWith('ORGANIZATION');
    fireEvent.click(screen.getByRole('button', { name: fr.myTransfers.personalOnly }));
    expect(await screen.findByText(row.description)).toBeVisible();
    expect(myPayoutTransfersApi.list).toHaveBeenCalledWith('PERSONAL', 0);
  });
  it('sépare société et personne, ferme le détail et ouvre la configuration du bon bénéficiaire', async () => {
    vi.mocked(paymentConnectApi.status).mockImplementation(async (scope) => ({ ...initial, scope, canManageOrganization: true }));
    vi.mocked(myPayoutTransfersApi.list).mockImplementation(async (scope) => ({ content: scope === 'PERSONAL' ? [row] : [], totalElements: scope === 'PERSONAL' ? 1 : 0, totalPages: 1 }));
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Maintenance de la Villa Atlas/ }));
    await screen.findByText(fr.myTransfers.advice.TRANSFERRED);
    fireEvent.click(screen.getByRole('radio', { name: fr.onboarding.payment.ORGANIZATION }));
    expect(await screen.findByText(fr.myTransfers.empty)).toBeVisible();
    expect(screen.queryByText(row.description)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: fr.myTransfers.configure }));
    expect(await screen.findByRole('img', { name: 'Stripe' })).toBeVisible();
    vi.mocked(paymentConnectApi.start).mockResolvedValue({ url: 'https://connect.stripe.com/setup' });
    fireEvent.click(screen.getByRole('button', { name: fr.onboarding.payment.connect }));
    await waitFor(() => expect(paymentConnectApi.start).toHaveBeenCalledExactlyOnceWith('ORGANIZATION', 'FR', 'CONNECT'));
    expect(screen.getAllByRole('radio')).toHaveLength(2); // Pas de second choix contradictoire dans SetupPayout.
  });
  it('ne réutilise ni historique ni autorisations après un changement d’identité', async () => {
    vi.mocked(paymentConnectApi.status).mockResolvedValue({ ...initial, canManageOrganization: true });
    const view = mount(); fireEvent.click(await screen.findByRole('button', { name: /Maintenance de la Villa Atlas/ }));
    await screen.findByText(fr.myTransfers.advice.TRANSFERRED);
    auth.user.id = 43;
    vi.mocked(paymentConnectApi.status).mockResolvedValue(initial);
    vi.mocked(myPayoutTransfersApi.list).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0 });
    view.rerender(<QueryClientProvider client={view.client}><MyPayoutTransfers /></QueryClientProvider>);
    expect(await screen.findByText(fr.myTransfers.empty)).toBeVisible();
    expect(screen.queryByText(row.description)).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(myPayoutTransfersApi.detail).toHaveBeenCalledOnce();
  });
  it('ignore une redirection PSP reçue après déconnexion du bénéficiaire', async () => {
    let resolve!: (value: { url: string }) => void;
    vi.mocked(paymentConnectApi.start).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = mount(); await screen.findByText(row.description);
    fireEvent.click(screen.getByRole('button', { name: fr.myTransfers.configure }));
    fireEvent.click(await screen.findByRole('button', { name: fr.onboarding.payment.connect }));
    await waitFor(() => expect(paymentConnectApi.start).toHaveBeenCalledOnce());
    view.unmount(); resolve({ url: 'https://connect.stripe.com/setup' });
    await new Promise((done) => setTimeout(done, 0));
    expect(redirectToPaymentProvider).not.toHaveBeenCalled();
  });
  it('permet de réessayer après une panne sans annoncer un historique vide', async () => {
    vi.mocked(myPayoutTransfersApi.list).mockRejectedValueOnce(new Error('offline'));
    mount(); expect(await screen.findByRole('alert')).toHaveTextContent(fr.myTransfers.loadError);
    expect(screen.queryByText(fr.myTransfers.empty)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText(row.description)).toBeVisible();
  });
  it('ne présente pas un statut de compte périmé comme actuel après une panne', async () => {
    vi.mocked(paymentConnectApi.status).mockRejectedValue(new Error('offline'));
    mount(); expect(await screen.findByText(fr.myTransfers.accountStates.unavailable)).toBeVisible();
    expect(screen.queryByText(fr.myTransfers.accountStates.ready)).not.toBeInTheDocument();
    expect(await screen.findByText(row.description)).toBeVisible();
  });
  it('revient sur une page existante après une actualisation', async () => {
    vi.mocked(myPayoutTransfersApi.list).mockResolvedValueOnce({ content: [row], totalElements: 13, totalPages: 2 })
      .mockResolvedValueOnce({ content: [], totalElements: 12, totalPages: 1 });
    mount(); await screen.findByText(row.description);
    fireEvent.click(screen.getByText('Suivant'));
    await waitFor(() => expect(myPayoutTransfersApi.list).toHaveBeenCalledTimes(3));
    expect(myPayoutTransfersApi.list).toHaveBeenLastCalledWith('PERSONAL', 0);
  });
});
