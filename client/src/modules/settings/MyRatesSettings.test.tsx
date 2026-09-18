// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyRatesSettings from './MyRatesSettings';
import { housekeeperRatesApi } from '../../services/api/housekeeperRatesApi';

vi.mock('../../services/api/housekeeperRatesApi', () => ({ housekeeperRatesApi: { getMy: vi.fn(), updateMy: vi.fn() } }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { success: vi.fn(), error: vi.fn() } }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const base = { referenceHourlyRate: 42, hourlyAmount: null, currency: 'MAD', properties: [] };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MyRatesSettings /></QueryClientProvider>);
}

it('requires confirmation of migrated amounts instead of prefilling zero', async () => {
  vi.mocked(housekeeperRatesApi.getMy).mockResolvedValue({ ...base, needsReview: true });
  mount();
  expect(await screen.findByText('providerTariff.review')).toBeTruthy();
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('');
  expect(screen.queryByText('settings.myRates.flatSection')).toBeNull();
});

it('saves one global rate with the displayed currency and no property exceptions', async () => {
  vi.mocked(housekeeperRatesApi.getMy).mockResolvedValue({ ...base, hourlyAmount: 50, amount: 50, pricingModel: 'HOURLY' });
  vi.mocked(housekeeperRatesApi.updateMy).mockResolvedValue({ ...base, hourlyAmount: 60 });
  mount();
  const price = await screen.findByRole('spinbutton');
  await waitFor(() => expect((price as HTMLInputElement).value).toBe('50'));
  fireEvent.change(price, { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: 'settings.myRates.save' }));
  await waitFor(() => expect(housekeeperRatesApi.updateMy).toHaveBeenCalledWith({ hourlyAmount: 60, flatRates: [], currency: 'MAD', pricingModel: 'HOURLY' }));
});

it('preserves a global flat rate instead of silently converting it to hourly', async () => {
  vi.mocked(housekeeperRatesApi.getMy).mockResolvedValue({ ...base, amount: 120, pricingModel: 'FLAT' });
  vi.mocked(housekeeperRatesApi.updateMy).mockResolvedValue({ ...base, amount: 120, pricingModel: 'FLAT' });
  mount();
  const price = await screen.findByRole('spinbutton');
  await waitFor(() => expect((price as HTMLInputElement).value).toBe('120'));
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('FLAT');
  fireEvent.click(screen.getByRole('button', { name: 'settings.myRates.save' }));
  await waitFor(() => expect(housekeeperRatesApi.updateMy).toHaveBeenCalledWith({ hourlyAmount: 120, flatRates: [], currency: 'MAD', pricingModel: 'FLAT' }));
});
