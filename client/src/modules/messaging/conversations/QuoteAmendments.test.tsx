// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuoteAmendments from './QuoteAmendments';
import { serviceQuotesApi } from '../../../services/api/serviceQuotesApi';

const auth = vi.hoisted(() => ({ user: { id: 9, organizationId: 7 } as { id: number; organizationId: number } | null, loading: false }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../services/api/serviceQuotesApi', () => ({ serviceQuotesApi: {
  cancellation: vi.fn(), agreement: vi.fn(), amendments: vi.fn(), amendmentAccess: vi.fn(), proposeAmendment: vi.fn(), decideAmendment: vi.fn(), downloadAmendment: vi.fn(),
} }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../components/ui', () => ({
  Button: ({ variant: _variant, size: _size, ...props }: any) => <button {...props} />,
  Input: (props: any) => <input {...props} />,
  Textarea: (props: any) => <textarea {...props} />,
}));

let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(serviceQuotesApi.cancellation).mockResolvedValue({ canCancel: false, missionVersion: null, unavailableReason: null, reason: null, cancelledAt: null });
  auth.user = { id: 9, organizationId: 7 };
  auth.loading = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(serviceQuotesApi.agreement).mockResolvedValue({ quoteId: 1, originalAmount: 120, agreedAmount: 120, currency: 'EUR', amendmentId: null });
  vi.mocked(serviceQuotesApi.amendments).mockResolvedValue([{ id: 4, version: 3, quoteId: 1, interventionId: 2,
    originalAmount: 120, proposedAmount: 150, currency: 'EUR', reason: 'Travaux', status: 'PROPOSED',
    proposedBy: 8, createdAt: '2026-09-15T12:00:00Z', decidedBy: null, decidedAt: null }]);
  vi.mocked(serviceQuotesApi.amendmentAccess).mockResolvedValue({ actorId: 9, canPropose: false, canDecide: true, canAccept: true, canWithdrawOwn: false });
});
afterEach(() => { cleanup(); client.clear(); });
const mount = () => render(<QueryClientProvider client={client}><QuoteAmendments quoteId={1} /></QueryClientProvider>);

describe('QuoteAmendments', () => {
  it('hides the agreement and history after a refresh denies access', async () => {
    mount(); fireEvent.click(screen.getByText('quoteAmendments.title'));
    await screen.findByText('Travaux');
    vi.mocked(serviceQuotesApi.amendmentAccess).mockRejectedValue(new Error('Forbidden'));
    await act(() => client.invalidateQueries({ queryKey: ['service-quotes'] }));
    await screen.findByText('quoteAmendments.loadFailed');
    expect(screen.queryByText('Travaux')).toBeNull();
    expect(screen.queryByText('quoteAmendments.current')).toBeNull();
    expect(screen.queryByText('quoteAmendments.accept')).toBeNull();
    vi.mocked(serviceQuotesApi.amendmentAccess).mockResolvedValue({ actorId: 9, canPropose: false, canDecide: true, canAccept: true, canWithdrawOwn: false });
    fireEvent.click(screen.getByText('quoteAmendments.retry'));
    await screen.findByText('Travaux');
  });

  it.each([{ id: 10, organizationId: 7 }, { id: 9, organizationId: 8 }])(
    'isolates cached terms and drafts when the identity becomes %j', async identity => {
      vi.mocked(serviceQuotesApi.amendmentAccess).mockResolvedValue({ actorId: 9, canPropose: true, canDecide: false, canAccept: false, canWithdrawOwn: true });
      const view = mount(); fireEvent.click(screen.getByText('quoteAmendments.title'));
      fireEvent.change(await screen.findByLabelText('quoteAmendments.amount'), { target: { value: '180' } });
      fireEvent.change(screen.getByLabelText('quoteAmendments.reason'), { target: { value: 'Brouillon privé' } });
      vi.mocked(serviceQuotesApi.amendments).mockResolvedValue([]);
      let resolveAgreement!: (value: Awaited<ReturnType<typeof serviceQuotesApi.agreement>>) => void;
      vi.mocked(serviceQuotesApi.agreement).mockImplementationOnce(() => new Promise(resolve => { resolveAgreement = resolve; }));
      auth.user = identity;
      view.rerender(<QueryClientProvider client={client}><QuoteAmendments quoteId={1} /></QueryClientProvider>);
      expect(screen.queryByText('Travaux')).toBeNull();
      expect(screen.queryByText('quoteAmendments.current')).toBeNull();
      expect(screen.queryByDisplayValue('Brouillon privé')).toBeNull();
      fireEvent.click(screen.getByText('quoteAmendments.title'));
      expect(screen.queryByText('quoteAmendments.propose')).toBeNull();
      expect(serviceQuotesApi.proposeAmendment).not.toHaveBeenCalled();
      await act(async () => resolveAgreement({ quoteId: 1, originalAmount: 120, agreedAmount: 120, currency: 'EUR', amendmentId: null }));
      const amount = await screen.findByLabelText('quoteAmendments.amount');
      expect((amount as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('quoteAmendments.reason') as HTMLTextAreaElement).value).toBe('');
    },
  );

  it('does not load private data while authentication is unresolved or absent', () => {
    auth.loading = true;
    const view = mount();
    expect(serviceQuotesApi.agreement).not.toHaveBeenCalled();
    auth.loading = false; auth.user = null;
    view.rerender(<QueryClientProvider client={client}><QuoteAmendments quoteId={1} /></QueryClientProvider>);
    expect(serviceQuotesApi.amendmentAccess).not.toHaveBeenCalled();
    expect(screen.queryByText('quoteAmendments.title')).toBeNull();
  });

  it('keeps an old mutation result out of the next quote and clears its draft', async () => {
    vi.mocked(serviceQuotesApi.amendments).mockResolvedValue([]);
    vi.mocked(serviceQuotesApi.amendmentAccess).mockResolvedValue({ actorId: 9, canPropose: true, canDecide: false, canAccept: false, canWithdrawOwn: true });
    let rejectProposal!: (error: Error) => void;
    vi.mocked(serviceQuotesApi.proposeAmendment).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectProposal = reject; }));
    const view = mount(); fireEvent.click(screen.getByText('quoteAmendments.title'));
    fireEvent.change(await screen.findByLabelText('quoteAmendments.amount'), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText('quoteAmendments.reason'), { target: { value: 'Ancien devis' } });
    fireEvent.click(screen.getByText('quoteAmendments.propose'));
    view.rerender(<QueryClientProvider client={client}><QuoteAmendments quoteId={2} /></QueryClientProvider>);
    fireEvent.click(screen.getByText('quoteAmendments.title'));
    await screen.findByLabelText('quoteAmendments.amount');
    await act(async () => rejectProposal(new Error('Erreur de l’ancien devis')));
    await waitFor(() => expect((screen.getByLabelText('quoteAmendments.amount') as HTMLInputElement).disabled).toBe(false));
    expect(screen.queryByText('Erreur de l’ancien devis')).toBeNull();
    expect((screen.getByLabelText('quoteAmendments.reason') as HTMLTextAreaElement).value).toBe('');
    expect(serviceQuotesApi.proposeAmendment).toHaveBeenCalledExactlyOnceWith(1, 180, 'Ancien devis');
  });

  it('downloads only the selected accepted amendment and reports conversion failure', async () => {
    const amendments = await serviceQuotesApi.amendments(1);
    vi.mocked(serviceQuotesApi.amendments).mockResolvedValue([
      ...amendments, { ...amendments[0], id: 5, status: 'ACCEPTED', decidedBy: 9, decidedAt: '2026-09-15T12:30:00Z' },
    ]);
    vi.mocked(serviceQuotesApi.downloadAmendment).mockRejectedValue(new Error('Unavailable'));
    mount(); fireEvent.click(screen.getByText('quoteAmendments.title'));
    const button = await screen.findByText('quoteAmendments.downloadPdf');
    fireEvent.click(button);
    await screen.findByText('quoteAmendments.pdfFailed');
    expect(serviceQuotesApi.downloadAmendment).toHaveBeenCalledExactlyOnceWith(5);
    expect(serviceQuotesApi.decideAmendment).not.toHaveBeenCalled();
  });
  it('sends the displayed version and prevents double acceptance', async () => {
    vi.mocked(serviceQuotesApi.decideAmendment).mockImplementation(() => new Promise(() => {}));
    mount();
    fireEvent.click(screen.getByText('quoteAmendments.title'));
    const button = await screen.findByText('quoteAmendments.accept');
    fireEvent.click(button); fireEvent.click(button);
    expect(serviceQuotesApi.decideAmendment).toHaveBeenCalledExactlyOnceWith(4, 3, 'accept');
  });

  it.each(['150,25', '١٥٠٫٢٥'])('preserves the provider draft %s after failure', async input => {
    vi.mocked(serviceQuotesApi.amendments).mockResolvedValue([]);
    vi.mocked(serviceQuotesApi.amendmentAccess).mockResolvedValue({ actorId: 8, canPropose: true, canDecide: false, canAccept: false, canWithdrawOwn: true });
    vi.mocked(serviceQuotesApi.proposeAmendment).mockRejectedValue({ message: 'Mission modifiée' });
    mount(); fireEvent.click(screen.getByText('quoteAmendments.title'));
    const amount = await screen.findByLabelText('quoteAmendments.amount');
    fireEvent.change(amount, { target: { value: input } });
    fireEvent.change(screen.getByLabelText('quoteAmendments.reason'), { target: { value: 'Travaux' } });
    fireEvent.click(screen.getByText('quoteAmendments.propose'));
    await screen.findByText('Mission modifiée');
    expect(serviceQuotesApi.proposeAmendment).toHaveBeenCalledWith(1, 150.25, 'Travaux');
    expect((amount as HTMLInputElement).value).toBe(input);
    expect(screen.queryByText('quoteAmendments.accept')).toBeNull();
  });

  it('does not offer decisions when access cannot be loaded', async () => {
    vi.mocked(serviceQuotesApi.amendmentAccess).mockRejectedValue(new Error('Forbidden'));
    mount(); fireEvent.click(screen.getByText('quoteAmendments.title'));
    await screen.findByText('quoteAmendments.loadFailed');
    await waitFor(() => expect(screen.queryByText('quoteAmendments.accept')).toBeNull());
    expect(screen.queryByText('quoteAmendments.propose')).toBeNull();
  });
});
