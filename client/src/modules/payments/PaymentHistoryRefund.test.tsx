import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PaymentHistoryPage from './PaymentHistoryPage';

const api = vi.hoisted(() => ({ getPage: vi.fn(), getHosts: vi.fn(), refund: vi.fn(), refundInstallment: vi.fn(), refundInstallmentStatus: vi.fn() }));
const interventions = vi.hoisted(() => ({ getById: vi.fn() }));
const measuredLayout = vi.hoisted(() => ({ enabled: false, mounts: 0 }));
vi.mock('../../services/api/paymentsApi', () => ({ paymentsApi: api }));
vi.mock('../../services/api/interventionsApi', () => ({ interventionsApi: interventions }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { roles: ['SUPER_ADMIN'] } }) }));
vi.mock('../../components/Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} EUR</span> }));
vi.mock('../../components/PageHeaderActionsContext', () => ({ usePageHeaderFilters: (node: React.ReactNode) => node, usePageHeaderActions: () => null }));
vi.mock('../billing/components/FinanceKpis', () => ({ FinanceAmountKpis: ({ amountGroups }: any) =>
  <output aria-label="Total financier">{amountGroups?.find((group: any) => group.key === 'all')?.totals[0]?.[1] ?? 0}</output> }));
vi.mock('./FinanceBatchPanel', () => ({ FinanceBatchPanel: () => null }));
vi.mock('../../components/PagePagination', () => ({ default: ({ count, page, onPageChange }: any) =>
  <><span>{count} dossiers</span><button onClick={() => onPageChange(page + 1)}>Page suivante</button></> }));
vi.mock('../../components/DataFetchWrapper', () => ({ default: ({ children, loading }: any) =>
  measuredLayout.enabled && loading ? null : children }));
vi.mock('../billing/components/FinanceWorkspace', async () => {
  const { useEffect, useState } = await import('react');
  return { default: ({ items, pagination, onPageSizeChange, selectedId }: any) => {
    const [capacity, setCapacity] = useState(10);
    useEffect(() => {
      if (measuredLayout.enabled) { measuredLayout.mounts++; setCapacity(5); }
    }, []);
    useEffect(() => {
      if (measuredLayout.enabled) onPageSizeChange?.(capacity);
    }, [capacity, onPageSizeChange]);
    return <div data-testid="finance-list" data-selected={String(selectedId)}>
      {items.map((item: any) => <div key={item.id}>{item.title}{item.headerActions}</div>)}{pagination}</div>;
  } };
});
vi.mock('./PaymentRecordDetail', () => ({ default: () => null,
  PaymentRecordActions: ({ onRefund, canRefund }: any) => canRefund && <button onClick={onRefund}>Demander un remboursement</button> }));

beforeEach(() => {
  vi.clearAllMocks();
  measuredLayout.enabled = false;
  measuredLayout.mounts = 0;
  interventions.getById.mockResolvedValue({ paymentStatus: 'PAID' });
  api.getHosts.mockResolvedValue([]);
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PAID', amount: 35,
    supportsPartialRefund: true,
    currency: 'EUR', description: 'Ménage de départ', createdAt: '2026-10-05', transactionDate: '2026-10-05' }], totalElements: 1, totalPages: 1, amountGroups: [] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('keeps measured layout mounted while fetching its adjusted page capacity', async () => {
  measuredLayout.enabled = true;
  let complete!: (value: any) => void;
  const response = { content: [{ id: 1, referenceId: 1, type: 'INTERVENTION', status: 'PENDING', amount: 35,
    currency: 'EUR', description: 'Dossier conservé' }], totalElements: 456, totalPages: 92, amountGroups: [] };
  api.getPage.mockImplementation(({ size }) => size === 10 ? Promise.resolve(response)
    : new Promise(resolve => { complete = resolve; }));
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await waitFor(() => expect(api.getPage).toHaveBeenCalledTimes(2));
  expect(api.getPage).toHaveBeenLastCalledWith(expect.objectContaining({ size: 5 }));
  expect(screen.getByText('Dossier conservé')).toBeVisible();
  expect(screen.getByTestId('finance-list')).toHaveAttribute('data-selected', 'null');
  complete(response);
  await waitFor(() => expect(screen.getByText('456 dossiers')).toBeVisible());
  expect(measuredLayout.mounts).toBe(1);
  expect(api.getPage).toHaveBeenCalledTimes(2);
});

it('loads only the requested page while keeping totals for the complete filtered history', async () => {
  const amounts = [{ key: 'all', artwork: 'documents', count: 456, unavailable: 0, totals: [['EUR', 158930.42]] }];
  api.getPage.mockImplementation(async ({ page, size }) => ({
    content: [{ id: page + 1, referenceId: page + 1, type: 'INTERVENTION', status: 'PENDING', amount: 35,
      currency: 'EUR', description: `Dossier page ${page}`, canCollect: false }],
    totalElements: 456, totalPages: Math.ceil(456 / size), amountGroups: amounts,
  }));
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  expect(await screen.findByText('Dossier page 0')).toBeVisible();
  expect(screen.getByText('456 dossiers')).toBeVisible();
  expect(screen.getByLabelText('Total financier')).toHaveTextContent('158930.42');
  expect(api.getPage).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 10 }));
  fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
  expect(await screen.findByText('Dossier page 1')).toBeVisible();
  expect(screen.queryByText('Dossier page 0')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Total financier')).toHaveTextContent('158930.42');
  expect(api.getPage).toHaveBeenCalledTimes(2);
  expect(api.getPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, includeAmounts: false }));
});

it('ignores an old page response after a newer navigation', async () => {
  let complete!: (value: any) => void;
  api.getPage.mockImplementation(({ page }) => page === 0 ? new Promise(resolve => { complete = resolve; })
    : Promise.resolve({ content: [{ id: 2, referenceId: 2, type: 'INTERVENTION', status: 'PENDING', amount: 35,
      currency: 'EUR', description: 'Page récente' }], totalElements: 456, totalPages: 46, amountGroups: [] }));
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await waitFor(() => expect(api.getPage).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
  expect(await screen.findByText('Page récente')).toBeVisible();
  complete({ content: [{ id: 1, referenceId: 1, type: 'INTERVENTION', status: 'PENDING', amount: 35,
    currency: 'EUR', description: 'Page ancienne' }], totalElements: 456, totalPages: 46, amountGroups: [] });
  await waitFor(() => expect(screen.getByText('Page récente')).toBeVisible());
  expect(screen.queryByText('Page ancienne')).not.toBeInTheDocument();
});

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
  expect(api.getPage).toHaveBeenCalledTimes(1);
});

it('closes and reloads confirmed data only after a successful refund', async () => {
  api.refund.mockResolvedValue({ status: 'COMPLETED', message: 'Confirmé' });
  interventions.getById.mockResolvedValue({ paymentStatus: 'REFUNDED' });
  fireEvent.click(await openRefund());
  await waitFor(() => expect(api.getPage).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps following the refund when Stripe confirms before the Baitly journal', async () => {
  let reconcile!: (value: { paymentStatus: string }) => void;
  api.refund.mockResolvedValue({ status: 'COMPLETED', message: 'Confirmé' });
  interventions.getById.mockImplementation(() => new Promise(resolve => { reconcile = resolve; }));
  fireEvent.click(await openRefund());
  expect(await screen.findByText(/Mise à jour du paiement/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled();
  expect(api.getPage).toHaveBeenCalledTimes(1);
  reconcile({ paymentStatus: 'REFUNDED' });
  await waitFor(() => expect(api.getPage).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.refund).toHaveBeenCalledTimes(1);
});

it('keeps an error visible without marking the payment refunded', async () => {
  api.refund.mockRejectedValue(new Error('Rapprochement requis'));
  fireEvent.click(await openRefund());
  expect(await screen.findByText('Rapprochement requis')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(api.getPage).toHaveBeenCalledTimes(1);
});

it('displays the business explanation returned as an ApiError object', async () => {
  api.refund.mockRejectedValue({ status: 400, message: 'Un remboursement existe déjà pour ce paiement.' });
  fireEvent.click(await openRefund());
  expect(await screen.findByText('Un remboursement existe déjà pour ce paiement.')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('does not offer another refund while an external proof requires reconciliation', async () => {
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PAID', amount: 35,
    currency: 'EUR', description: 'Ménage', refundReviewRequired: true, refundPendingAmount: 5 }], totalElements: 1, totalPages: 1, amountGroups: [] });
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await waitFor(() => expect(api.getPage).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Demander un remboursement' })).not.toBeInTheDocument();
  expect(api.refund).not.toHaveBeenCalled();
});

it('refreshes a late dispute on focus and removes the refund action without a page reload', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Demander un remboursement' })).toBeVisible();
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PAID', amount: 35,
    currency: 'EUR', description: 'Ménage', paymentDisputed: true }], totalElements: 1, totalPages: 1, amountGroups: [] });
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Demander un remboursement' })).not.toBeInTheDocument());
  expect(api.getPage).toHaveBeenCalledTimes(2);
  expect(api.refund).not.toHaveBeenCalled();
});

it('does not refresh an inactive Finance tab', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Demander un remboursement' });
  fireEvent.focus(window);
  expect(api.getPage).toHaveBeenCalledTimes(1);
});

it('refunds only the selected amount and follows its proof instead of the old partial status', async () => {
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 15, type: 'INTERVENTION', status: 'PARTIALLY_REFUNDED', amount: 35,
    supportsPartialRefund: true,
    refundedAmount: 5, currency: 'EUR', description: 'Ménage', createdAt: '2026-10-05', transactionDate: '2026-10-05' }], totalElements: 1, totalPages: 1, amountGroups: [] });
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
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 414, type: 'INTERVENTION', status: 'PAID', amount: 45,
    supportsPartialRefund: false, currency: 'EUR', description: 'Ménage groupé' }], totalElements: 1, totalPages: 1, amountGroups: [] });
  api.refund.mockResolvedValue({ status: 'PROCESSING', message: 'Vérification Stripe en cours' });
  const button = await openRefund();
  expect(screen.getByLabelText(/Montant à rembourser/)).toHaveAttribute('readonly');
  expect(screen.getByText(/uniquement être remboursée en totalité/)).toBeVisible();
  fireEvent.click(button);
  await waitFor(() => expect(api.refund).toHaveBeenCalledWith(414));
  expect(api.refundInstallment).not.toHaveBeenCalled();
});

it('does not propose a second refund for an unsupported partially refunded line', async () => {
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 414, type: 'INTERVENTION', status: 'PARTIALLY_REFUNDED', amount: 45,
    refundedAmount: 5, supportsPartialRefund: false, currency: 'EUR', description: 'Ménage groupé' }], totalElements: 1, totalPages: 1, amountGroups: [] });
  render(<MemoryRouter><PaymentHistoryPage embedded /></MemoryRouter>);
  await waitFor(() => expect(api.getPage).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Demander un remboursement' })).not.toBeInTheDocument();
  expect(api.refund).not.toHaveBeenCalled();
  expect(api.refundInstallment).not.toHaveBeenCalled();
});

it('lets a confirmed batch allocation refund only its selected amount', async () => {
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 414, type: 'INTERVENTION', status: 'PAID', amount: 45,
    supportsPartialRefund: true, currency: 'EUR', description: 'Ménage groupé' }], totalElements: 1, totalPages: 1, amountGroups: [] });
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
  api.getPage.mockResolvedValue({ content: [{ id: 1, referenceId: 364, type: 'INTERVENTION', status: 'PAID', amount: 100,
    supportsPartialRefund: true, refundAcrossReceipts: true, currency: 'EUR', description: 'Maintenance avec acompte' }], totalElements: 1, totalPages: 1, amountGroups: [] });
  api.refundInstallment.mockResolvedValue({ status: 'PROCESSING', message: 'Confirmation des deux restitutions en cours', refundReference: 'REF-first-part' });
  api.refundInstallmentStatus.mockResolvedValue({ status: 'PROCESSING', reconciled: false });
  fireEvent.click(await openRefund());
  await waitFor(() => expect(api.refundInstallment).toHaveBeenCalledWith(364, 100, expect.any(String)));
  expect(api.refund).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled();
  expect(api.getPage).toHaveBeenCalledTimes(1);
});
