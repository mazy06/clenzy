import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import QuoteFinancialCase from './QuoteFinancialCase';
import apiClient from '../../../services/apiClient';
vi.mock('../../../services/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'fr' }) }));
let client: QueryClient;
const data = { canManage: true, dossier: { version: 3, state: 'OPEN', accounting_state: 'NONE', amount_due: 0, agreed_amount: 100, currency: 'EUR', last_error: null }, payments: [{ id: 5, provider: 'STRIPE', currency: 'eur', collected: 10000, refunded: 0, state: 'VERIFIED', shared: false }], decisions: [], events: [] };
beforeEach(() => { vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); vi.mocked(apiClient.get).mockResolvedValue(data); });
afterEach(() => { cleanup(); client.clear(); });
const mount = () => render(<QueryClientProvider client={client}><QuoteFinancialCase quoteId={1} accountScope="user:7" /></QueryClientProvider>);
it('proposes the amount without automatically approving a refund and blocks double clicks', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(apiClient.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount(); await screen.findByText('financialCase.title');
  fireEvent.change(screen.getByLabelText('financialCase.reason'), { target: { value: 'Aucune prestation réalisée' } });
  fireEvent.change(screen.getByLabelText('financialCase.source'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText(/^financialCase.amount /), { target: { value: '12.34' } });
  const button = screen.getByRole('button', { name: 'financialCase.propose' }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
  expect(apiClient.post).toHaveBeenCalledWith('/service-quotes/1/financial-case', expect.objectContaining({ action: 'PROPOSE', amount: 1234, paymentId: 5, version: 3 }));
  await act(async () => finish(data));
});
it('requires a reason before approving and keeps approval disabled during a dispute', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ...data, dossier: { ...data.dossier, state: 'DISPUTED' }, decisions: [{ id: 'one', payment_id: 5, amount: 1000, reason: 'Proposition', state: 'PROPOSED' }] });
  mount(); const button = await screen.findByRole('button', { name: 'financialCase.approve' });
  fireEvent.change(screen.getByLabelText('financialCase.reason'), { target: { value: 'Accord' } });
  expect(button).toBeDisabled(); expect(apiClient.post).not.toHaveBeenCalled();
});
it('hides financial details when access is revoked', async () => {
  mount(); await screen.findByText('financialCase.title');
  vi.mocked(apiClient.get).mockRejectedValue(new Error('Forbidden'));
  await act(() => client.invalidateQueries({ queryKey: ['mission-financial'] }));
  await screen.findByRole('alert'); expect(screen.queryByText('financialCase.title')).toBeNull();
});

it('keeps the recorded assessment as the default rather than replacing it with zero', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ...data, dossier: { ...data.dossier, amount_due: 42 } });
  mount(); const input = await screen.findByLabelText(/financialCase.amountDue/);
  expect(input).toHaveValue(42);
});
it('requires external refund evidence and never offers Stripe reconciliation for PayPal', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ...data, payments: [{ ...data.payments[0], provider: 'PAYPAL' }],
    decisions: [{ id: 'one', payment_id: 5, amount: 1000, reason: 'Proposition', state: 'REVIEW' }] });
  mount(); const button = await screen.findByRole('button', { name: 'financialCase.confirmExternal' });
  fireEvent.change(screen.getByLabelText('financialCase.reason'), { target: { value: 'Remboursement effectué' } });
  expect(button).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'financialCase.reconcileRefund' })).toBeNull();
  fireEvent.change(screen.getByLabelText('financialCase.externalRefundProof'), { target: { value: 'Reçu PP-12' } });
  expect(button).toBeEnabled();
});
