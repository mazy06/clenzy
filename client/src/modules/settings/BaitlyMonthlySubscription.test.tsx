vi.mock('../payments/BaitlySaleDocuments', () => ({ default: () => null }));
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BaitlyMonthlySubscription from './BaitlyMonthlySubscription';
import { baitlySubscriptionApi as api } from '../../services/api/baitlySubscriptionApi';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 2, organizationId: 3 } }) }));
vi.mock('../../services/api/baitlySubscriptionApi', async importOriginal => ({ ...await importOriginal<typeof import('../../services/api/baitlySubscriptionApi')>(), baitlySubscriptionApi: { billingCountry: vi.fn(), updateBillingCountry: vi.fn(), proposal: vi.fn(), contracts: vi.fn(), invoices: vi.fn(), checkout: vi.fn(), refresh: vi.fn(), abandon: vi.fn(), cancel: vi.fn() } }));
const proposal = { phases: [1, 4, 7, 13].map((month, i) => ({ version: 'test', plan: 'essential' as const, market: 'EU', currency: 'EUR', properties: 1, subscriptionMonth: month, loyaltyPercent: i * 10, baseCents: 2900, volumeCents: 2900, totalCents: 2900 - i * 290 })), subscriptionMonth: 1, firstInvoiceExcludingTaxCents: 2900, promoCode: null, propertyCount: 1, previousPlan: null };
beforeEach(() => {
  vi.mocked(api.billingCountry).mockResolvedValue({ billingCountry: "FR", sellerCountry: "FR" });
  vi.mocked(api.proposal).mockResolvedValue(proposal);
  vi.mocked(api.contracts).mockResolvedValue([]);
  vi.mocked(api.invoices).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><BaitlyMonthlySubscription /></QueryClientProvider>); }
it('shows net phases and requires an applied promo before paying', async () => {
  open();const button = await screen.findByRole('button', { name: 'monthlySubscription.checkout' });
  expect(screen.getByText(/monthlySubscription.tax/)).toBeInTheDocument();
  expect(screen.getByText(/26,10/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('monthlySubscription.promo'), { target: { value: 'WELCOME' } });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'monthlySubscription.apply' }));
  await waitFor(() => expect(api.proposal).toHaveBeenLastCalledWith('essential', 'WELCOME'));
});
it('reuses the request identifier after an uncertain failure and blocks double clicks', async () => {
  open();const button = await screen.findByRole('button', { name: 'monthlySubscription.checkout' });
  let reject!: (reason: Error) => void;
  vi.mocked(api.checkout).mockReturnValueOnce(new Promise((_, r) => { reject = r; }));
  fireEvent.click(button);fireEvent.click(button);
  await waitFor(() => expect(api.checkout).toHaveBeenCalledTimes(1));
  const request = vi.mocked(api.checkout).mock.calls[0][1];
  reject(new Error('network'));
  await screen.findByRole('alert');
  vi.mocked(api.checkout).mockRejectedValue(new Error('network'));
  fireEvent.click(button);
  await waitFor(() => expect(api.checkout).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.checkout).mock.calls[1][1]).toBe(request);
});
it('resumes the persisted attempt, including its original empty promo', async () => {
  vi.mocked(api.contracts).mockResolvedValue([{ id: 7, requestId: 'request-saved', plan: 'pro', status: 'CHECKOUT_OPEN', currency: 'EUR', properties: 1, firstInvoiceExcludingTaxCents: 4900, monthOneCents: 4900, monthFourCents: 4410, monthSevenCents: 3920, monthThirteenCents: 3430, promoCode: null, paidUntil: null, cancelAtPeriodEnd: false }]);
  vi.mocked(api.checkout).mockRejectedValue(new Error('network'));
  open();fireEvent.click(await screen.findByRole('button', { name: 'monthlySubscription.resume' }));
  await waitFor(() => expect(api.checkout).toHaveBeenCalledWith('pro', 'request-saved', null));
  expect(screen.queryByRole('button', { name: 'monthlySubscription.checkout' })).toBeNull();
});
it('never treats a return query parameter as proof of payment', async () => {
  window.history.replaceState({}, '', '/settings?tab=subscription&subscription=return');
  open();await screen.findByRole('button', { name: 'monthlySubscription.checkout' });
  expect(api.checkout).not.toHaveBeenCalled();expect(api.refresh).not.toHaveBeenCalled();
  expect(screen.queryByText('monthlySubscription.status.ACTIVE')).toBeNull();
});

it('requires saving the billing country before allowing a payment', async () => {
  open();const checkout = await screen.findByRole('button', { name: 'monthlySubscription.checkout' });
  await waitFor(() => expect(checkout).toBeEnabled());
  fireEvent.change(screen.getByLabelText('signupMonthly.country'), { target: { value: 'MA' } });
  await waitFor(() => expect(checkout).toBeDisabled());
  expect(api.checkout).not.toHaveBeenCalled();
  vi.mocked(api.billingCountry).mockResolvedValue({ billingCountry: 'MA', sellerCountry: 'MA' });
  fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
  await waitFor(() => expect(api.updateBillingCountry).toHaveBeenCalledWith('MA'));
  await waitFor(() => expect(checkout).toBeEnabled());
});
it('locks the billing country while a contract is already being prepared', async () => {
  vi.mocked(api.contracts).mockResolvedValue([{ id: 7, requestId: 'request-saved', plan: 'pro', status: 'CHECKOUT_OPEN', currency: 'EUR', properties: 1, firstInvoiceExcludingTaxCents: 4900, monthOneCents: 4900, monthFourCents: 4410, monthSevenCents: 3920, monthThirteenCents: 3430, promoCode: null, paidUntil: null, cancelAtPeriodEnd: false }]);
  open();expect(await screen.findByLabelText('signupMonthly.country')).toBeDisabled();
});
