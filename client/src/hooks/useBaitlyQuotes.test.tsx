import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBaitlyQuoteDecision, useBaitlyQuotes, type BaitlyQuoteEntry } from './useBaitlyQuotes';
const mock = vi.hoisted(() => ({ user: { id: 1, organizationId: 2 }, get: vi.fn(), accept: vi.fn(), approve: vi.fn(), reject: vi.fn(), decline: vi.fn(), withdraw: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user, loading: false }) }));
vi.mock('../services/apiClient', () => ({ default: { get: mock.get } }));
vi.mock('../services/api/serviceQuotesApi', () => ({ serviceQuotesApi: { approve: mock.approve, reject: mock.reject } }));
vi.mock('../services/api/quoteRequestsApi', () => ({ quoteRequestsApi: { accept: mock.accept, decline: mock.decline, withdraw: mock.withdraw } }));
vi.mock('./invalidateMissionWorkflow', () => ({ invalidateMissionWorkflow: vi.fn().mockResolvedValue(undefined) }));
const entry = { key: 'quote-22', quoteId: 22, requestId: null, canDecide: true, canWithdraw: false, expired: false } as BaitlyQuoteEntry;
const clients: QueryClient[] = [];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={clients.at(-1)!}>{children}</QueryClientProvider>;
}
function client() { clients.push(new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })); }
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.clearAllMocks(); mock.user = { id: 1, organizationId: 2 }; });

it('uses the existing service quote command for intervention decisions', async () => {
  client();
  const { result } = renderHook(() => useBaitlyQuoteDecision(), { wrapper });
  await act(async () => { await result.current.mutateAsync({ entry, action: 'accept' }); });
  expect(mock.approve).toHaveBeenCalledExactlyOnceWith(22);
  expect(mock.accept).not.toHaveBeenCalled();
});
it('uses the request identity when a commercial quote already represents a marketplace request', async () => {
  client();
  const { result } = renderHook(() => useBaitlyQuoteDecision(), { wrapper });
  await act(async () => { await result.current.mutateAsync({ entry: { ...entry, requestId: 4 }, action: 'accept' }); });
  expect(mock.accept).toHaveBeenCalledExactlyOnceWith(4);
  expect(mock.approve).not.toHaveBeenCalled();
});
it('does not dispatch unauthorized or expired decisions', async () => {
  client();
  const { result } = renderHook(() => useBaitlyQuoteDecision(), { wrapper });
  await expect(result.current.mutateAsync({ entry: { ...entry, canDecide: false }, action: 'accept' })).rejects.toThrow();
  await expect(result.current.mutateAsync({ entry: { ...entry, expired: true }, action: 'decline' })).rejects.toThrow();
  expect(mock.accept).not.toHaveBeenCalled(); expect(mock.approve).not.toHaveBeenCalled(); expect(mock.reject).not.toHaveBeenCalled();
});
it('paginates on the server and does not reuse another account’s cached quotes', async () => {
  client();
  mock.get.mockResolvedValueOnce({ items: [entry], totalPages: 1 });
  const { result, rerender } = renderHook(() => useBaitlyQuotes('ALL', 0), { wrapper });
  await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
  expect(mock.get).toHaveBeenCalledWith('/quotes', { params: { view: 'ALL', page: 0, size: 20 } });
  mock.get.mockImplementation(() => new Promise(() => {}));
  mock.user = { id: 9, organizationId: 7 };
  rerender();
  expect(result.current.data).toBeUndefined();
});
