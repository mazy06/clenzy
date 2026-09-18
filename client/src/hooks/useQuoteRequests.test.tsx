// @vitest-environment jsdom
import React from 'react';
import { expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSentQuotes } from './useQuoteRequests';
import { quoteRequestsApi } from '../services/api/quoteRequestsApi';
const auth = vi.hoisted(() => ({ user: { id: 1, organizationId: 7 }, loading: false }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../services/api/quoteRequestsApi', () => ({ quoteRequestsApi: { sent: vi.fn() } }));
vi.mock('./useNotification', () => ({ useNotification: () => ({ notify: {} }) }));
vi.mock('./useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it('does not retain another account list while fetching the new account', async () => {
  const first = { items: [], page: 0, size: 20, totalElements: 7, totalPages: 1 };
  vi.mocked(quoteRequestsApi.sent).mockResolvedValueOnce(first)
    .mockImplementation(() => new Promise(() => {}));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender, unmount } = renderHook(() => useSentQuotes(undefined, 0), { wrapper });
  await waitFor(() => expect(result.current.data?.totalElements).toBe(7));
  auth.user = { id: 2, organizationId: 8 }; rerender();
  await waitFor(() => expect(quoteRequestsApi.sent).toHaveBeenCalledTimes(2));
  expect(result.current.data).toBeUndefined();
  unmount(); client.clear();
});
