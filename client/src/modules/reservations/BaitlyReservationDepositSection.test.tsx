import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyReservationDepositSection from './BaitlyReservationDepositSection';
import { baitlySecurityDepositsApi } from '../../services/api/baitlySecurityDepositsApi';

vi.mock('../../services/api/baitlySecurityDepositsApi', () => ({ baitlySecurityDepositsApi: { byReservation: vi.fn() } }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ currentLanguage: 'fr', t: (key: string, fallback?: string) => fallback ?? key }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><BaitlyReservationDepositSection reservationId={88} /></QueryClientProvider>);
  return client;
}
it('shows the original currency and held status without claiming a release', async () => {
  vi.mocked(baitlySecurityDepositsApi.byReservation).mockResolvedValue({ id: 1, reservationId: 88, amount: 350, currency: 'MAD', status: 'HELD', capturedAmount: null, holdExpiresAt: null });
  const client = mount();
  expect(await screen.findByText('reservationsDeposit.statuses.HELD')).toBeVisible();
  expect(screen.getByText(/350.*MAD/)).toBeVisible();
  expect(screen.queryByText(/Libération bancaire confirmée/)).toBeNull();
  client.clear();
});
it('only announces release when the backend confirms RELEASED', async () => {
  vi.mocked(baitlySecurityDepositsApi.byReservation).mockResolvedValue({ id: 1, reservationId: 88, amount: 5, currency: 'EUR', status: 'RELEASED', capturedAmount: null, holdExpiresAt: null });
  const client = mount();
  expect(await screen.findByText(/Libération bancaire confirmée/)).toBeVisible();
  expect(screen.getByText('reservationsDeposit.statuses.RELEASED')).toBeVisible();
  client.clear();
});
it('does not invent a deposit when the backend reports none', async () => {
  vi.mocked(baitlySecurityDepositsApi.byReservation).mockResolvedValue(null);
  const client = mount();
  await vi.waitFor(() => expect(client.getQueryState(['baitly-security-deposit', 88])?.status).toBe('success'));
  expect(screen.queryByText('Caution')).toBeNull();
  client.clear();
});
