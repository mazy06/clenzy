import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PayoutTrackingTab, { ReconciliationForm } from './PayoutTrackingTab';
import { payoutTransfersApi, type PayoutTransfer } from '../../../services/api/payoutTransfersApi';

vi.mock('../../../services/api/payoutTransfersApi', () => ({ payoutTransfersApi: { list: vi.fn(), listAll: vi.fn(), detail: vi.fn(), verify: vi.fn(), confirm: vi.fn(), monitoring: vi.fn() } }));
vi.mock('../../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: (node: React.ReactNode) => node }));
vi.mock('../../../components/ScreenChrome', () => ({ useScreenSearch: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 1, organizationId: 7, organizationName: 'Baitly France' } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth }));

const row: PayoutTransfer = { id: 1, source: 'INTERVENTION', sourceId: 11, beneficiaryUserId: null, beneficiaryOrganizationId: 9,
  amount: 80, currency: 'EUR', provider: 'STRIPE', state: 'RECONCILIATION_REQUIRED', externalReference: null,
  createdAt: '2026-10-05T08:00:00Z', updatedAt: '2026-10-05T08:01:00Z', description: 'Maintenance de la Villa Atlas' };
const proof = { reference: 'tr_match', destination: 'acct_company', livemode: false, createdAt: row.createdAt };
function mount(form = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const updated = vi.fn();
  const view = render(<QueryClientProvider client={client}>{form ? <ReconciliationForm transfer={row} onUpdated={updated} /> : <PayoutTrackingTab />}</QueryClientProvider>);
  return { ...view, updated, client };
}
async function verifyReference() {
  fireEvent.change(screen.getByLabelText('Référence Stripe'), { target: { value: 'tr_match' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier la référence' }));
  await screen.findByText('Référence et dossier concordants');
}
beforeEach(() => {
  vi.resetAllMocks(); auth.user.organizationId = 7;
  vi.mocked(payoutTransfersApi.listAll).mockResolvedValue([row]);
  vi.mocked(payoutTransfersApi.list).mockResolvedValue({ content: [row], totalElements: 1, totalPages: 1 });
  vi.mocked(payoutTransfersApi.monitoring).mockResolvedValue({ recoveryEnabled: false, providerConfigured: true, alerts: { content: [], totalElements: 0, totalPages: 0 } });
  vi.mocked(payoutTransfersApi.detail).mockResolvedValue({ transfer: row, events: [], bankPayouts: [] });
  vi.mocked(payoutTransfersApi.verify).mockResolvedValue(proof);
  vi.mocked(payoutTransfersApi.confirm).mockResolvedValue({ ...row, state: 'TRANSFERRED', externalReference: 'tr_match' });
});
afterEach(cleanup);

describe('Suivi des versements Baitly', () => {
  it.each([
    ['FUNDING_DISPUTED', 'Encaissement contesté après transfert', 'aucune récupération n’est présumée'],
    ['REFUND_RECOVERY_REQUIRED', 'Récupération après remboursement à vérifier', 'récupération du transfert reste à confirmer'],
  ] as const)('signale %s même si le versement bancaire est terminé, sans émettre d’argent', async (code, label, advice) => {
    vi.mocked(payoutTransfersApi.monitoring).mockResolvedValue({ recoveryEnabled: false, providerConfigured: true,
      alerts: { content: [{ transferId: 1, description: row.description, code }], totalElements: 1, totalPages: 1 } });
    mount(); fireEvent.click(await screen.findByText('Points à vérifier'));
    expect(await screen.findByText(label)).toBeVisible();
    expect(screen.getByText(new RegExp(advice))).toBeVisible();
    expect(payoutTransfersApi.confirm).not.toHaveBeenCalled();
  });
  it.each([
    { state: 'RECOVERED' as const, amount: 4.29, commissionRefundAmount: 0.72, total: '5,01', label: 'Fonds récupérés' },
    { state: 'NO_RECOVERY_REQUIRED' as const, amount: 0, commissionRefundAmount: 0.01, total: '0,01', label: 'Aucune récupération nécessaire' },
  ])('affiche la répartition du remboursement $state sans inventer un mouvement prestataire', async (allocation) => {
    vi.mocked(payoutTransfersApi.detail).mockResolvedValue({ transfer: { ...row, state: 'TRANSFERRED' }, events: [], bankPayouts: [],
      recoveries: [{ ...allocation, currency: 'EUR', updatedAt: row.updatedAt }] });
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Maintenance de la Villa Atlas/ }));
    const recovery = await screen.findByRole('region', { name: 'Récupération après remboursement' });
    expect(recovery).toHaveTextContent('Part à récupérer auprès du bénéficiaire');
    expect(recovery).toHaveTextContent('Complément financé par la plateforme');
    expect(recovery).toHaveTextContent('Montant du remboursement');
    expect(recovery).toHaveTextContent(allocation.total);
    expect(recovery).toHaveTextContent(allocation.label);
    if (allocation.state === 'NO_RECOVERY_REQUIRED') {
      expect(recovery).toHaveTextContent('Aucun fonds n’est repris au bénéficiaire');
      expect(recovery).not.toHaveTextContent('Fonds récupérés');
      expect(recovery).not.toHaveTextContent('trr_');
    }
    expect(payoutTransfersApi.confirm).not.toHaveBeenCalled();
  });
  it.each(['RECOVERED', 'REVIEW_REQUIRED'] as const)('sépare la récupération %s du transfert historique et de la réception bancaire', async (state) => {
    vi.mocked(payoutTransfersApi.detail).mockResolvedValue({ transfer: { ...row, state: 'TRANSFERRED' }, events: [], bankPayouts: [],
      recoveries: [{ state, amount: 30, currency: 'EUR', updatedAt: row.updatedAt, reversalReference: state === 'RECOVERED' ? 'trr_confirmed' : null }] });
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Maintenance de la Villa Atlas/ }));
    const recovery = await screen.findByRole('region', { name: 'Récupération après remboursement' });
    expect(recovery).toHaveTextContent('30,00');
    if (state === 'RECOVERED') expect(recovery).toHaveTextContent('Fonds récupérés');
    else {
      expect(recovery).toHaveTextContent('Le client est remboursé, mais le retour des fonds du bénéficiaire n’est pas confirmé');
      expect(recovery).not.toHaveTextContent('Fonds récupérés');
    }
    expect(screen.getByText(/réception en banque n’est pas confirmée/)).toBeVisible();
    expect(payoutTransfersApi.confirm).not.toHaveBeenCalled();
  });
  it('affiche le rattrapage désactivé sans présenter les versements comme reçus', async () => {
    mount();expect(await screen.findByText('Rattrapage automatique désactivé')).toBeVisible();
    expect(screen.getByText(/Cela ne confirme pas la réception/)).toBeVisible();
  });
  it('ouvre le dossier depuis une alerte sans déclencher de paiement', async () => {
    vi.mocked(payoutTransfersApi.monitoring).mockResolvedValue({ recoveryEnabled: true, providerConfigured: true,
      alerts: { content: [{ transferId: 1, description: row.description, code: 'RECONCILIATION_REQUIRED' }], totalElements: 1, totalPages: 1 } });
    mount();fireEvent.click(await screen.findByText('Points à vérifier'));
    fireEvent.click(screen.getByRole('button', { name: /Transfert à rapprocher.*Maintenance/ }));
    expect(await screen.findByLabelText('Référence Stripe')).toBeVisible();
    expect(payoutTransfersApi.confirm).not.toHaveBeenCalled();
  });
  it('distingue une panne de surveillance d’une absence d’alerte et permet de réessayer', async () => {
    vi.mocked(payoutTransfersApi.monitoring).mockRejectedValueOnce(new Error('offline'));
    mount();expect(await screen.findByRole('alert')).toHaveTextContent('alertes sont indisponibles');
    expect(screen.queryByText(/Aucun point à vérifier/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Rattrapage automatique désactivé')).toBeVisible();
  });
  it('sépare transfert et réception bancaire, sans affirmer un crédit en banque', async () => {
    mount();fireEvent.click(await screen.findByRole('button', { name: /Maintenance de la Villa Atlas/ }));
    expect(await screen.findByText(/réception en banque n’est pas confirmée/)).toBeVisible();
    expect(screen.getByText('Organisation #9')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Vérifier la référence' })).toBeDisabled();
    expect(payoutTransfersApi.confirm).not.toHaveBeenCalled();
  });
  it('requiert vérification puis confirmation explicite et distingue le mode test', async () => {
    mount(true); await verifyReference();
    expect(screen.getByText(/Mode test/)).toBeVisible();
    const confirm = screen.getByRole('button', { name: 'Confirmer le rapprochement' });expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(confirm);
    await waitFor(() => expect(payoutTransfersApi.confirm).toHaveBeenCalledExactlyOnceWith(1, 'tr_match'));
    expect(await screen.findByText('Rapprochement enregistré.')).toBeVisible();
  });
  it('invalide la preuve et le consentement lorsque la référence change', async () => {
    mount(true);await verifyReference();fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Référence Stripe'), { target: { value: 'tr_other' } });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmer le rapprochement' })).not.toBeInTheDocument();
  });
  it('ne permet pas de confirmer une référence rejetée', async () => {
    vi.mocked(payoutTransfersApi.verify).mockRejectedValue(new Error('409'));
    mount(true);fireEvent.change(screen.getByLabelText('Référence Stripe'), { target: { value: 'tr_match' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier la référence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('dossier reste inchangé');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(payoutTransfersApi.confirm).not.toHaveBeenCalled();
  });
  it('actualise le dossier après une réponse de confirmation perdue', async () => {
    vi.mocked(payoutTransfersApi.confirm).mockRejectedValue(new Error('offline'));
    const view = mount(true);await verifyReference();fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rapprochement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirmation non reçue');
    expect(view.updated).toHaveBeenCalledOnce();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
  it('filtre côté serveur et conserve des caches distincts par organisation', async () => {
    const view = mount();await screen.findByText(row.description);
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'RECONCILIATION_REQUIRED' } });
    await waitFor(() => expect(payoutTransfersApi.list).toHaveBeenLastCalledWith({ page: 0, state: 'RECONCILIATION_REQUIRED', source: '', search: '' }));
    auth.user.organizationId = 8;
    vi.mocked(payoutTransfersApi.list).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0 });
    view.rerender(<QueryClientProvider client={view.client}><PayoutTrackingTab /></QueryClientProvider>);
    expect(await screen.findByText('Aucun transfert à afficher')).toBeVisible();
    expect(screen.queryByText(row.description)).not.toBeInTheDocument();
  });
  it('propose une nouvelle lecture après un échec de chargement', async () => {
    vi.mocked(payoutTransfersApi.list).mockRejectedValueOnce(new Error('offline'));
    mount();fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText(row.description)).toBeVisible();
  });
  it('revient sur une page existante quand le dernier résultat disparaît', async () => {
    vi.mocked(payoutTransfersApi.list).mockResolvedValueOnce({ content: [row], totalElements: 13, totalPages: 2 })
      .mockResolvedValueOnce({ content: [], totalElements: 12, totalPages: 1 });
    mount(); await screen.findByText(row.description);
    fireEvent.click(screen.getByText('Suivant'));
    await waitFor(() => expect(payoutTransfersApi.list).toHaveBeenCalledTimes(3));
    expect(payoutTransfersApi.list).toHaveBeenLastCalledWith({ page: 0, state: '', source: '', search: '' });
  });
});
