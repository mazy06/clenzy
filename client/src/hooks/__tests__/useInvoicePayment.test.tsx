import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePayInvoice } from '../useInvoices';
import { invoicesApi } from '../../services/api/invoicesApi';

vi.mock('../useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../providers/PostHogProvider', () => ({ trackEvent: {} }));
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return { client, wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.restoreAllMocks(); });

it('returns the Checkout URL without optimistically declaring the invoice paid', async () => {
  const { client, wrapper } = setup();
  const issued = [{ id: 5, status: 'ISSUED' }];
  client.setQueryData(['invoices'], issued);
  const call = vi.spyOn(invoicesApi, 'initiatePayment').mockResolvedValue({ paymentResult: { success: true, redirectUrl: 'https://checkout.stripe.com/c/pay/test' } });
  const hook = renderHook(() => usePayInvoice(), { wrapper });
  await act(async () => expect(await hook.result.current.mutateAsync(5)).toBe('https://checkout.stripe.com/c/pay/test'));
  expect(call).toHaveBeenCalledWith(5);
  expect(client.getQueryData(['invoices'])).toEqual(issued);
});

it.each([
  { success: false, redirectUrl: 'https://checkout.stripe.com/c/pay/test' },
  { success: true, redirectUrl: null },
  { success: true, redirectUrl: 'javascript:alert(1)' },
  { success: true, redirectUrl: 'http://checkout.stripe.com/c/pay/test' },
])('rejects incomplete or unsafe Checkout results: %j', async paymentResult => {
  vi.spyOn(invoicesApi, 'initiatePayment').mockResolvedValue({ paymentResult });
  const hook = renderHook(() => usePayInvoice(), { wrapper: setup().wrapper });
  await act(async () => {
    await expect(hook.result.current.mutateAsync(5)).rejects.toThrow('Lien de paiement non généré.');
  });
});

it('preserves the server reconciliation reason instead of pretending the payment succeeded', async () => {
  vi.spyOn(invoicesApi, 'initiatePayment').mockResolvedValue({ paymentResult: { success: false, errorMessage: 'Facture déjà encaissée : rapprochement requis' } });
  const hook = renderHook(() => usePayInvoice(), { wrapper: setup().wrapper });
  await act(async () => {
    await expect(hook.result.current.mutateAsync(5)).rejects.toThrow('rapprochement requis');
  });
});
