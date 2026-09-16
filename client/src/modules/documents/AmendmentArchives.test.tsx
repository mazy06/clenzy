// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AmendmentArchives from './AmendmentArchives';
import { serviceQuotesApi } from '../../services/api/serviceQuotesApi';

const search = vi.hoisted(() => ({ change: (_value: string) => {} }));
const auth = vi.hoisted(() => ({ user: { id: 'provider', organizationId: 7 }, loading: false }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/api/serviceQuotesApi', () => ({ serviceQuotesApi: { amendmentArchives: vi.fn(), downloadAmendment: vi.fn() } }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'fr' }) }));
vi.mock('../../components/ScreenChrome', () => ({ useScreenSearch: (_value: string, change: (v: string) => void) => { search.change = change; } }));
vi.mock('../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: (actions: React.ReactNode) => actions }));
vi.mock('../../components/EmptyState', () => ({ default: ({ title }: { title: string }) => <p>{title}</p> }));
vi.mock('../../components/PagePagination', () => ({ default: ({ onPageChange }: { onPageChange: (page: number) => void }) => <button onClick={() => onPageChange(1)}>next page</button> }));
vi.mock('../../components/ui', () => ({
  Button: ({ variant: _variant, size: _size, ...props }: any) => <button {...props} />,
  Badge: ({ variant: _variant, ...props }: any) => <span {...props} />,
  Alert: ({ variant: _variant, ...props }: any) => <div {...props} />,
  AlertDescription: (props: any) => <p {...props} />,
  Skeleton: (props: any) => <div {...props} />,
}));
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { id: 'provider', organizationId: 7 };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(serviceQuotesApi.amendmentArchives).mockResolvedValue({ number: 0, size: 20, totalElements: 40, totalPages: 2,
    content: [
      { id: 4, quoteId: 1, interventionId: 2, originalAmount: 120, proposedAmount: 150, currency: 'EUR', reason: 'Travaux', decidedAt: '2026-09-15T12:00:00Z', archivedAt: '2026-09-15T12:01:00Z', archiveStatus: 'READY' },
      { id: 5, quoteId: 3, interventionId: 4, originalAmount: 120, proposedAmount: 160, currency: 'EUR', reason: 'Réparation', decidedAt: '2026-09-15T12:00:00Z', archivedAt: null, archiveStatus: 'PREPARING' },
    ],
  });
});
afterEach(() => { cleanup(); client.clear(); });
const mount = () => render(<QueryClientProvider client={client}><AmendmentArchives /></QueryClientProvider>);

describe('AmendmentArchives', () => {
  it('downloads only ready archives and prevents duplicate clicks', async () => {
    vi.mocked(serviceQuotesApi.downloadAmendment).mockImplementation(() => new Promise(() => {}));
    mount();
    const button = await screen.findByLabelText('amendmentLibrary.download');
    expect(screen.getAllByLabelText('amendmentLibrary.download')).toHaveLength(1);
    expect(screen.getByText('amendmentLibrary.status.PREPARING')).toBeTruthy();
    fireEvent.click(button); fireEvent.click(button);
    expect(serviceQuotesApi.downloadAmendment).toHaveBeenCalledExactlyOnceWith(4);
  });
  it('forwards pagination and resets it when the search changes', async () => {
    mount(); await screen.findByText('Travaux');
    fireEvent.click(screen.getByText('next page'));
    await waitFor(() => expect(serviceQuotesApi.amendmentArchives).toHaveBeenCalledWith(1, 20, ''));
    act(() => search.change('Réparation'));
    await waitFor(() => expect(serviceQuotesApi.amendmentArchives).toHaveBeenCalledWith(0, 20, 'Réparation'));
  });
  it('hides previously loaded entries when refreshed access fails', async () => {
    mount(); await screen.findByText('Travaux');
    vi.mocked(serviceQuotesApi.amendmentArchives).mockRejectedValue(new Error('Forbidden'));
    await act(async () => { await client.invalidateQueries({ queryKey: ['service-quotes', 'amendment-archives'] }); });
    await screen.findByText('amendmentLibrary.loadFailed');
    expect(screen.queryByText('Travaux')).toBeNull();
    expect(screen.queryByLabelText('amendmentLibrary.download')).toBeNull();
  });
  it('reports a failed download without losing the list', async () => {
    vi.mocked(serviceQuotesApi.downloadAmendment).mockRejectedValue(new Error('Unavailable'));
    mount(); fireEvent.click(await screen.findByLabelText('amendmentLibrary.download'));
    await screen.findByText('quoteAmendments.pdfFailed');
    expect(screen.getByText('Travaux')).toBeTruthy();
  });
  it('does not reuse another account or organization cached list', async () => {
    const view = mount(); await screen.findByText('Travaux');
    auth.user = { id: 'another-provider', organizationId: 9 };
    vi.mocked(serviceQuotesApi.amendmentArchives).mockImplementation(() => new Promise(() => {}));
    view.rerender(<QueryClientProvider client={client}><AmendmentArchives /></QueryClientProvider>);
    expect(screen.queryByText('Travaux')).toBeNull();
    expect(screen.queryByLabelText('amendmentLibrary.download')).toBeNull();
  });
});
