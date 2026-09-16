import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderProvisioningPanel from './ProviderProvisioningPanel';
import { marketplaceProvidersApi } from '../../services/api/marketplaceProvidersApi';
import fr from '../../../public/locales/fr.json';
import en from '../../../public/locales/en.json';
import ar from '../../../public/locales/ar.json';

vi.mock('../../services/api/marketplaceProvidersApi', () => ({
  marketplaceProvidersApi: { getProvisioning: vi.fn(), retryProvisioning: vi.fn(), getInvitation: vi.fn() },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));

const failed = { status: 'FAILED', requiresReview: true, attempts: 5, updatedAt: '2026-09-15T10:00:00', lastOutcome: 'FAILED' } as const;
function mount(overrides = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ProviderProvisioningPanel provider={{
    id: 12, status: 'ACTIVE', emailConfirmedAt: '2026-09-14', ...overrides,
  }} /></QueryClientProvider>);
  return client;
}
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(marketplaceProvidersApi.getProvisioning).mockResolvedValue(failed);
  vi.mocked(marketplaceProvidersApi.getInvitation).mockResolvedValue(null);
});

describe('Provider provisioning', () => {
  it('provides every panel label and state in all three languages', () => {
    const keys = ['title', 'refresh', 'loadError', 'empty', 'review', 'attempts', 'updated',
      'ineligible', 'retry', 'retrying', 'conflict', 'retryError', 'queued'];
    for (const locale of [fr, en, ar]) {
      const labels = locale.marketplaceProvisioning;
      for (const key of keys) expect(labels).toHaveProperty(key, expect.any(String));
      for (const status of ['PENDING', 'RUNNING', 'RETRY', 'SUCCEEDED', 'FAILED']) {
        expect(labels.status).toHaveProperty(status, expect.any(String));
        expect(labels.hint).toHaveProperty(status, expect.any(String));
      }
    }
  });
  it.each([{ status: 'SUSPENDED' }, { emailConfirmedAt: undefined }])('prevents retry for an ineligible profile %j', async (overrides) => {
    mount(overrides);
    await screen.findByText('marketplaceProvisioning.ineligible');
    expect(screen.queryByRole('button', { name: 'marketplaceProvisioning.retry' })).toBeNull();
  });

  it('does not offer a second attempt while the current worker is running', async () => {
    vi.mocked(marketplaceProvidersApi.getProvisioning).mockResolvedValue({ ...failed, status: 'RUNNING', requiresReview: false });
    mount();
    await screen.findByText('marketplaceProvisioning.status.RUNNING');
    expect(screen.queryByRole('button', { name: 'marketplaceProvisioning.retry' })).toBeNull();
  });

  it('allows a stalled worker to be retried and prevents duplicate clicks', async () => {
    vi.mocked(marketplaceProvidersApi.getProvisioning).mockResolvedValue({ ...failed, status: 'RUNNING' });
    let finish!: () => void;
    vi.mocked(marketplaceProvidersApi.retryProvisioning).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'marketplaceProvisioning.retry' }));
    const pending = await screen.findByRole('button', { name: 'marketplaceProvisioning.retrying' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(marketplaceProvidersApi.retryProvisioning).toHaveBeenCalledExactlyOnceWith(12);
    vi.mocked(marketplaceProvidersApi.getProvisioning).mockResolvedValue({ ...failed, status: 'PENDING', requiresReview: false });
    finish();
    await screen.findByText('marketplaceProvisioning.status.PENDING');
    await screen.findByText('marketplaceProvisioning.queued');
  });

  it('refreshes after a concurrent retry conflict', async () => {
    vi.mocked(marketplaceProvidersApi.retryProvisioning).mockImplementation(async () => {
      vi.mocked(marketplaceProvidersApi.getProvisioning).mockResolvedValue({ ...failed, status: 'RUNNING', requiresReview: false });
      throw { status: 409 };
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'marketplaceProvisioning.retry' }));
    await screen.findByText('marketplaceProvisioning.conflict');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'marketplaceProvisioning.retry' })).toBeNull());
  });

  it('distinguishes missing history from a failed request', async () => {
    vi.mocked(marketplaceProvidersApi.getProvisioning).mockResolvedValue(null);
    mount();
    await screen.findByText('marketplaceProvisioning.empty');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an actionable error when progress cannot be loaded', async () => {
    vi.mocked(marketplaceProvidersApi.getProvisioning).mockRejectedValue({ status: 503 });
    mount();
    await screen.findByText('marketplaceProvisioning.loadError');
    expect(screen.getByRole('button', { name: 'marketplaceProvisioning.refresh' })).toBeEnabled();
  });

  it('distinguishes mail server acceptance from account activation', async () => {
    vi.mocked(marketplaceProvidersApi.getInvitation).mockResolvedValue({
      status: 'SENT', attempts: 2, sentAt: '2026-09-15T12:00:00', updatedAt: '2026-09-15T12:00:00',
      nextAttemptAt: null, expiresAt: '2026-09-22T12:00:00', linkAvailable: false,
    });
    mount();
    await screen.findByText('marketplaceInvitation.status.SENT');
    expect(screen.getByText('marketplaceInvitation.unavailable')).toBeInTheDocument();
    expect(screen.queryByText('marketplaceInvitation.next')).toBeNull();
    expect(screen.queryByText('marketplaceInvitation.expires')).toBeNull();
  });

  it('shows invitation errors independently and permits a fresh read', async () => {
    vi.mocked(marketplaceProvidersApi.getInvitation).mockRejectedValue({ status: 503 });
    mount();
    await screen.findByText('marketplaceInvitation.error');
    expect(screen.getByText('marketplaceProvisioning.status.FAILED')).toBeInTheDocument();
    vi.mocked(marketplaceProvidersApi.getInvitation).mockResolvedValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'marketplaceInvitation.refresh' }));
    await screen.findByText('marketplaceInvitation.empty');
  });

  it('provides all invitation diagnostics in French, English and Arabic', () => {
    for (const locale of [fr, en, ar]) {
      const labels = locale.marketplaceInvitation;
      for (const key of ['title', 'refresh', 'error', 'empty', 'attempts', 'sent', 'next', 'expires', 'unavailable']) {
        expect(labels).toHaveProperty(key, expect.any(String));
      }
      for (const status of ['PENDING', 'RUNNING', 'RETRY', 'PAUSED', 'SENT', 'CANCELLED', 'EXPIRED']) {
        expect(labels.status).toHaveProperty(status, expect.any(String));
        expect(labels.hint).toHaveProperty(status, expect.any(String));
      }
    }
  });
});
