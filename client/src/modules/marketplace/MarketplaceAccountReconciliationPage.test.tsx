import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MarketplaceAccountReconciliationPage from './MarketplaceAccountReconciliationPage';
import apiClient from '../../services/apiClient';

vi.mock('../../services/apiClient', () => ({ default: { post: vi.fn() } }));
vi.mock('../../components/PageHeader', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
function mount(id = '42') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/reconcile/' + id]}>
    <Routes><Route path="/reconcile/:providerId" element={<MarketplaceAccountReconciliationPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>);
}

describe('Owner account reconciliation', () => {
  it('requires an explicit action and prevents duplicate submissions', async () => {
    let finish!: (value: { outcome: string }) => void;
    vi.mocked(apiClient.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount();
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'marketplaceReconciliation.confirm' }));
    const pending = await screen.findByRole('button', { name: 'marketplaceReconciliation.pending' });
    expect(pending).toBeDisabled(); fireEvent.click(pending);
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/me/marketplace-reconciliation/42');
    finish({ outcome: 'EXISTING_ACCOUNT_LINKED' });
    await screen.findByText('marketplaceReconciliation.success');
    expect(screen.getByRole('button', { name: 'marketplaceReconciliation.account' })).toBeEnabled();
  });

  it('does not report an active competing worker as a successful linking', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ outcome: 'DEFERRED' });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'marketplaceReconciliation.confirm' }));
    await screen.findByText('marketplaceReconciliation.deferred');
    expect(screen.queryByText('marketplaceReconciliation.success')).toBeNull();
  });

  it('explains an ownership rejection', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ status: 403 });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'marketplaceReconciliation.confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('marketplaceReconciliation.denied');
  });

  it.each(['0', 'invalid', '9007199254740992'])('does not submit an invalid identifier %s', id => {
    mount(id);
    expect(screen.getByRole('button', { name: 'marketplaceReconciliation.confirm' })).toBeDisabled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
