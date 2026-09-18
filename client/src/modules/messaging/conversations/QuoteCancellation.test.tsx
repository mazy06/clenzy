import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuoteCancellation from './QuoteCancellation';
import { serviceQuotesApi, type QuoteCancellationView } from '../../../services/api/serviceQuotesApi';

vi.mock('../../../services/api/serviceQuotesApi', () => ({ serviceQuotesApi: { cancellation: vi.fn(), cancelAgreement: vi.fn() } }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let client: QueryClient;
const available: QuoteCancellationView = { canCancel: true, missionVersion: 4, unavailableReason: null, reason: null, cancelledAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue(available);
});
afterEach(() => { cleanup(); client.clear(); });
const mount = () => render(<QueryClientProvider client={client}><QuoteCancellation quoteId={1} accountScope="user:7" /></QueryClientProvider>);
async function open() {
  fireEvent.click(await screen.findByRole('button', { name: 'quoteCancellation.title' }));
}

describe('Quote cancellation', () => {
  it('cancels an agreement without a planned mission using a null version', async () => {
    vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue({ ...available, missionVersion: null });
    vi.mocked(serviceQuotesApi.cancelAgreement).mockResolvedValue({ ...available, canCancel: false, cancelledAt: '2026-09-16T10:00:00Z' });
    mount(); await open();
    fireEvent.change(screen.getByLabelText('quoteCancellation.reason'), { target: { value: 'Accord abandonné' } });
    fireEvent.click(screen.getByRole('button', { name: 'quoteCancellation.confirm' }));
    await waitFor(() => expect(serviceQuotesApi.cancelAgreement).toHaveBeenCalledWith(1, null, 'Accord abandonné'));
  });
  it.each([
    ['LINKED_REQUEST', 'linkedRequest'], ['NO_MISSION', 'noMission'],
  ])('explains the unsupported %s lifecycle without enabling an incomplete cancellation', async (unavailableReason, key) => {
    vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue({ ...available, canCancel: false, unavailableReason });
    mount();
    await screen.findByText('quoteCancellation.' + key);
    expect(screen.queryByRole('button', { name: 'quoteCancellation.title' })).toBeNull();
  });
  it('requires an explicit reason and submits the displayed mission version once', async () => {
    let finish!: (value: QuoteCancellationView) => void;
    vi.mocked(serviceQuotesApi.cancelAgreement).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount(); await open();
    const confirm = screen.getByRole('button', { name: 'quoteCancellation.confirm' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('quoteCancellation.reason'), { target: { value: '  Remplacement  ' } });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(serviceQuotesApi.cancelAgreement).toHaveBeenCalledExactlyOnceWith(1, 4, 'Remplacement');
    expect(screen.getByLabelText('quoteCancellation.reason')).toBeDisabled();
    const cancelled = { ...available, canCancel: false, reason: 'Remplacement', cancelledAt: '2026-09-16T10:00:00Z' };
    vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue(cancelled);
    finish(cancelled);
    await screen.findByText('quoteCancellation.cancelled');
    expect(screen.queryByRole('button', { name: 'quoteCancellation.title' })).toBeNull();
    expect(screen.getByRole('link', { name: 'quoteCancellation.findProvider' })).toHaveAttribute('href', '/prestataires?replaceQuoteId=1');
  });

  it('does not offer cancellation while payment handling is unresolved', async () => {
    vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue({ ...available, canCancel: false, unavailableReason: 'PAYMENT_REVIEW_REQUIRED' });
    mount();
    await screen.findByText('quoteCancellation.paymentPending');
    expect(screen.queryByRole('button', { name: 'quoteCancellation.title' })).toBeNull();
    expect(serviceQuotesApi.cancelAgreement).not.toHaveBeenCalled();
  });

  it('hides the reason and decision when refreshed access is denied', async () => {
    vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue({ ...available, canCancel: false, reason: 'Private reason', cancelledAt: '2026-09-16T10:00:00Z' });
    mount(); await screen.findByText('Private reason');
    vi.mocked(serviceQuotesApi.cancellation).mockRejectedValue(new Error('Forbidden'));
    await act(() => client.invalidateQueries({ queryKey: ['service-quotes'] }));
    await screen.findByText('quoteCancellation.loadFailed');
    expect(screen.queryByText('Private reason')).toBeNull();
  });

  it('preserves the reason on failure and refreshes the authoritative version', async () => {
    vi.mocked(serviceQuotesApi.cancelAgreement).mockRejectedValue(new Error('stale'));
    mount(); await open();
    fireEvent.change(screen.getByLabelText('quoteCancellation.reason'), { target: { value: 'Reason' } });
    vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue({ ...available, missionVersion: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'quoteCancellation.confirm' }));
    await screen.findByText('quoteCancellation.failed');
    await waitFor(() => expect(screen.getByRole('button', { name: 'quoteCancellation.confirm' })).toBeEnabled());
    expect(screen.getByLabelText('quoteCancellation.reason')).toHaveValue('Reason');
    fireEvent.click(screen.getByRole('button', { name: 'quoteCancellation.confirm' }));
    await waitFor(() => expect(serviceQuotesApi.cancelAgreement).toHaveBeenLastCalledWith(1, 5, 'Reason'));
  });
});
