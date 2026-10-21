import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuoteMessageCard from './QuoteMessageCard';
import type { QuoteCardPayload } from '../../../services/api/contactApi';
const api = vi.hoisted(() => ({ list: vi.fn(), pdf: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 2 }, loading: false, hasAnyRole: () => true }) }));
vi.mock('../../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { success: vi.fn(), error: vi.fn() } }) }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string, fallback?: unknown) => typeof fallback === 'string' ? fallback : key }) }));
vi.mock('../../../services/api/serviceQuotesApi', () => ({ serviceQuotesApi: { list: api.list } }));
vi.mock('../../../services/api/documentsApi', () => ({ documentsApi: { fetchGenerationBlobUrl: api.pdf } }));
vi.mock('./QuoteAmendments', () => ({ default: () => null }));
let cache: QueryClient;
afterEach(() => { cleanup(); cache?.clear(); vi.clearAllMocks(); });
it('reads the live quote amount, status and PDF instead of the message snapshot', async () => {
  api.list.mockResolvedValue([{ id: 22, interventionId: 482, amount: 9, currency: 'EUR', status: 'APPROVED',
    documentGenerationId: 88, validUntil: null, lines: [] }]);
  api.pdf.mockRejectedValue(new Error('Unavailable'));
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter><QuoteMessageCard card={{
    kind: 'SERVICE_QUOTE', quoteId: 22, interventionId: 482, interventionTitle: 'Ménage',
    amount: 5, currency: 'EUR', documentGenerationId: 77,
  } as QuoteCardPayload} /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText(/9,00/)).toBeInTheDocument();
  expect(await screen.findByText('Approuvé')).toBeInTheDocument();
  expect(screen.queryByText(/5,00/)).toBeNull();
  expect(api.pdf).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu du devis' }));
  await waitFor(() => expect(api.pdf).toHaveBeenCalledExactlyOnceWith(88));
});
