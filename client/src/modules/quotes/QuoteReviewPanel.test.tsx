// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuoteReviewPanel from './QuoteReviewPanel';
import { quoteRequestsApi } from '../../services/api/quoteRequestsApi';
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 7 }, loading: false }) }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../services/api/quoteRequestsApi', () => ({ quoteRequestsApi: { review: vi.fn(), submitReview: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><QuoteReviewPanel quoteId={9} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Avis sur la mission' }));
}
it('does not offer a review before eligibility is confirmed', async () => {
  vi.mocked(quoteRequestsApi.review).mockResolvedValue({ canReview: false, rating: null, feedback: null, createdAt: null });
  mount();
  expect(await screen.findByText(/Un avis est possible après/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Enregistrer mon avis' })).toBeNull();
});
it('renders a saved review as text and cannot overwrite it', async () => {
  vi.mocked(quoteRequestsApi.review).mockResolvedValue({ canReview: false, rating: 4, feedback: '<script>bad</script>', createdAt: '2026-09-15T12:00:00' });
  mount();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Avis enregistré'));
  expect(await screen.findByText('<script>bad</script>')).toBeTruthy();
  expect(document.querySelector('script')).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
});
it('requires an explicit rating and submits once', async () => {
  vi.mocked(quoteRequestsApi.review).mockResolvedValue({ canReview: true, rating: null, feedback: null, createdAt: null });
  vi.mocked(quoteRequestsApi.submitReview).mockImplementation(() => new Promise(() => {}));
  mount();
  const save = await screen.findByRole('button', { name: 'Enregistrer mon avis' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
  fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(quoteRequestsApi.submitReview).toHaveBeenCalledExactlyOnceWith(9, 5, ''));
});
