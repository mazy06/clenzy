import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PaymentHistoryPage from './PaymentHistoryPage';

const api = vi.hoisted(() => ({ getAllHistory: vi.fn(), getHosts: vi.fn(), refund: vi.fn(), refundInstallment: vi.fn(), refundInstallmentStatus: vi.fn() }));
const interventions = vi.hoisted(() => ({ getById: vi.fn() }));
vi.mock('../../services/api/paymentsApi', () => ({ paymentsApi: api }));
vi.mock('../../services/api/interventionsApi', () => ({ interventionsApi: interventions }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { roles: ['SUPER_ADMIN'] } }) }));
vi.mock('../../components/Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} EUR</span> }));
vi.mock('../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: () => null }));
vi.mock('../billing/components/FinanceKpis', () => ({ FinanceAmountKpis: () => null }));
vi.mock('./FinanceBatchPanel', () => ({ FinanceBatchPanel: () => null }));
vi.mock('../../components/PagePagination', () => ({ default: () => null }));
vi.mock('../../components/DataFetchWrapper', () => ({ default: ({ children }: any) => children }));
vi.mock('../billing/components/FinanceWorkspace', () => ({ default: ({ items }: any) =>
  <div>{items.map((item: any) => <div key={item.id}>{item.headerActions}</div>)}</div> }));
vi.mock('./PaymentRecordDetail', () => ({ default: () => null,
  PaymentRecordActions: ({ onRefund, canRefund }: any) => canRefund && <button onClick={onRefund}>Demander un remboursement</button> }));

beforeEach(() => {
  vi.clearAllMocks();
  interventions.getById.mockResolvedValue({ paymentStatus: 'PAID' });
  api.getHosts.mockResolvedValue([]);
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PAID', amount: 35,
    supportsPartialRefund: true,
    currency: 'EUR', description: 'Ménage de départ', createdAt: '2026-10-05', transactionDate: '2026-10-05' }]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openRefund() {
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Demander un remboursement' }));
  return screen.getByRole('button', { name: 'Rembourser' });
}

it('keeps a pending refund visible and prevents a second submission', async () => {
  let complete!: (value: { status: string; message: string }) => void;
  api.refund.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const button = await openRefund();
  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(api.refund).toHaveBeenCalledTimes(1);
  complete({ status: 'PROCESSING', message: 'Vérification Stripe en cours' });
  expect(await screen.findByText('Vérification Stripe en cours')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled();
  expect(api.getAllHistory).toHaveBeenCalledTimes(1);
});

it('closes and reloads confirmed data only after a successful refund', async () => {
  api.refund.mockResolvedValue({ status: 'COMPLETED', message: 'Confirmé' });
  interventions.getById.mockResolvedValue({ paymentStatus: 'REFUNDED' });
  fireEvent.click(await openRefund());
  await waitFor(() => expect(api.getAllHistory).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps following the refund when Stripe confirms before the Baitly journal', async () => {
  let reconcile!: (value: { paymentStatus: string }) => void;
  api.refund.mockResolvedValue({ status: 'COMPLETED', message: 'Confirmé' });
  interventions.getById.mockImplementation(() => new Promise(resolve => { reconcile = resolve; }));
  fireEvent.click(await openRefund());
  expect(await screen.findByText(/Mise à jour du paiement/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled();
  expect(api.getAllHistory).toHaveBeenCalledTimes(1);
  reconcile({ paymentStatus: 'REFUNDED' });
  await waitFor(() => expect(api.getAllHistory).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.refund).toHaveBeenCalledTimes(1);
});

it('keeps an error visible without marking the payment refunded', async () => {
  api.refund.mockRejectedValue(new Error('Rapprochement requis'));
  fireEvent.click(await openRefund());
  expect(await screen.findByText('Rapprochement requis')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(api.getAllHistory).toHaveBeenCalledTimes(1);
});

it('displays the business explanation returned as an ApiError object', async () => {
  api.refund.mockRejectedValue({ status: 400, message: 'Un remboursement existe déjà pour ce paiement.' });
  fireEvent.click(await openRefund());
  expect(await screen.findByText('Un remboursement existe déjà pour ce paiement.')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('does not offer another refund while an external proof requires reconciliation', async () => {
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PAID', amount: 35,
    currency: 'EUR', description: 'Ménage', refundReviewRequired: true, refundPendingAmount: 5 }]);
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await waitFor(() => expect(api.getAllHistory).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Demander un remboursement' })).not.toBeInTheDocument();
  expect(api.refund).not.toHaveBeenCalled();
});

it('refreshes a late dispute on focus and removes the refund action without a page reload', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Demander un remboursement' })).toBeVisible();
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PAID', amount: 35,
    currency: 'EUR', description: 'Ménage', paymentDisputed: true }]);
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Demander un remboursement' })).not.toBeInTheDocument());
  expect(api.getAllHistory).toHaveBeenCalledTimes(2);
  expect(api.refund).not.toHaveBeenCalled();
});

it('does not refresh an inactive Finance tab', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Demander un remboursement' });
  fireEvent.focus(window);
  expect(api.getAllHistory).toHaveBeenCalledTimes(1);
});

it('refunds only the selected amount and follows its proof instead of the old partial status', async () => {
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PARTIALLY_REFUNDED', amount: 35,
    supportsPartialRefund: true,
    refundedAmount: 5, currency: 'EUR', description: 'Ménage', createdAt: '2026-10-05', transactionDate: '2026-10-05' }]);
  let reconcile!: (value: { reconciled: boolean }) => void;
  api.refundInstallment.mockResolvedValue({ status: 'COMPLETED', message: 'Confirmé', refundReference: 'REF-next' });
  api.refundInstallmentStatus.mockImplementation(() => new Promise(resolve => { reconcile = resolve; }));
  const button=await openRefund();
  const input=screen.getByLabelText(/Montant à rembourser/);
  expect(input).toHaveValue('30.00');
  fireEvent.change(input,{ target:{ value:'10,50' } });fireEvent.click(button);
  await waitFor(()=>expect(api.refundInstallment).toHaveBeenCalledWith(15,10.5,expect.any(String)));
  expect(api.refund).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeVisible();
  reconcile({ reconciled:true });
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('refuses an excessive refund before sending any request', async () => {
  const button=await openRefund();
  fireEvent.change(screen.getByLabelText(/Montant à rembourser/),{ target:{ value:'35.01' } });fireEvent.click(button);
  expect(await screen.findByText(/Saisissez un montant positif/)).toBeVisible();
  expect(api.refund).not.toHaveBeenCalled();expect(api.refundInstallment).not.toHaveBeenCalled();
});

it('keeps an unsupported historical line amount read-only and uses the full allocation refund', async () => {
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 414, type: 'INTERVENTION', status: 'PAID', amount: 45,
    supportsPartialRefund: false, currency: 'EUR', description: 'Ménage groupé' }]);
  api.refund.mockResolvedValue({ status: 'PROCESSING', message: 'Vérification Stripe en cours' });
  const button = await openRefund();
  expect(screen.getByLabelText(/Montant à rembourser/)).toHaveAttribute('readonly');
  expect(screen.getByText(/uniquement être remboursée en totalité/)).toBeVisible();
  fireEvent.click(button);
  await waitFor(() => expect(api.refund).toHaveBeenCalledWith(414));
  expect(api.refundInstallment).not.toHaveBeenCalled();
});

it('does not propose a second refund for an unsupported partially refunded line', async () => {
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 414, type: 'INTERVENTION', status: 'PARTIALLY_REFUNDED', amount: 45,
    refundedAmount: 5, supportsPartialRefund: false, currency: 'EUR', description: 'Ménage groupé' }]);
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await waitFor(() => expect(api.getAllHistory).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Demander un remboursement' })).not.toBeInTheDocument();
  expect(api.refund).not.toHaveBeenCalled();
  expect(api.refundInstallment).not.toHaveBeenCalled();
});

it('lets a confirmed batch allocation refund only its selected amount', async () => {
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 414, type: 'INTERVENTION', status: 'PAID', amount: 45,
    supportsPartialRefund: true, currency: 'EUR', description: 'Ménage groupé' }]);
  api.refundInstallment.mockResolvedValue({ status: 'PROCESSING', message: 'Vérification Stripe en cours', refundReference: 'REF-batch-part' });
  api.refundInstallmentStatus.mockResolvedValue({ reconciled: false });
  const button = await openRefund();
  expect(screen.getByLabelText(/Montant à rembourser/)).not.toHaveAttribute('readonly');
  fireEvent.change(screen.getByLabelText(/Montant à rembourser/), { target: { value: '5,01' } });
  fireEvent.click(button);
  await waitFor(() => expect(api.refundInstallment).toHaveBeenCalledWith(414, 5.01, expect.any(String)));
  expect(api.refund).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('follows the entire maintenance refund plan even when refunding its full deposit plus balance', async () => {
  api.getAllHistory.mockResolvedValue([{ id: 1, referenceId: 364, type: 'INTERVENTION', status: 'PAID', amount: 100,
    supportsPartialRefund: true, refundAcrossReceipts: true, currency: 'EUR', description: 'Maintenance avec acompte' }]);
  api.refundInstallment.mockResolvedValue({ status: 'PROCESSING', message: 'Confirmation des deux restitutions en cours', refundReference: 'REF-first-part' });
  api.refundInstallmentStatus.mockResolvedValue({ status: 'PROCESSING', reconciled: false });
  fireEvent.click(await openRefund());
  await waitFor(() => expect(api.refundInstallment).toHaveBeenCalledWith(364, 100, expect.any(String)));
  expect(api.refund).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled();
  expect(api.getAllHistory).toHaveBeenCalledTimes(1);
});
