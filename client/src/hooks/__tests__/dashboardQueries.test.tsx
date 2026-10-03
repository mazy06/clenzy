import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDashboardOccupancyByProperty, useDashboardRevenueSplit } from '../useDashboardAnalyticsBlocks';
import { portfolioAnalyticsQuery, portfolioAnalyticsApi, type PortfolioAnalytics } from '../../services/api/portfolioAnalyticsApi';
import { reportsApi } from '../../services/api/reportsApi';
import { useFinancialReport } from '../../modules/reports/hooks/useReportData';
import { accountingApi, type OwnerPayout } from '../../services/api/accountingApi';
import { reportViewsApi } from '../../services/api/reportViewsApi';

const auth = vi.hoisted(() => ({ user: { id: 'host-1', organizationId: 1 } as { id: string; organizationId: number } | null }));
vi.mock('../useAuth', () => ({ useAuth: () => auth }));
beforeEach(() => { auth.user = { id: 'host-1', organizationId: 1 }; });

const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; vi.restoreAllMocks(); vi.useRealTimers(); });

it('shares the portfolio fetch between reports and the dashboard while sorting a copy', async () => {
  const properties = [{ propertyId: 1, rate: 20 }, { propertyId: 2, rate: 80 }];
  const get = vi.spyOn(portfolioAnalyticsApi, 'get').mockResolvedValue({ occupancy: { byProperty: properties } } as PortfolioAnalytics);
  const hook = renderHook(() => ({ report: useQuery(portfolioAnalyticsQuery('month')), dashboard: useDashboardOccupancyByProperty('month') }), { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.dashboard.isSuccess).toBe(true));
  expect(get).toHaveBeenCalledTimes(1);
  expect(hook.result.current.dashboard.data?.map((row) => row.propertyId)).toEqual([2, 1]);
  expect(hook.result.current.report.data?.occupancy.byProperty).toEqual(properties);
});

it('deduplicates two financial report tiles', async () => {
  const get = vi.spyOn(reportsApi, 'getFinancialStats').mockResolvedValue({} as Awaited<ReturnType<typeof reportsApi.getFinancialStats>>);
  const hook = renderHook(() => [useFinancialReport(), useFinancialReport()], { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.every((query) => !query.loading)).toBe(true));
  expect(get).toHaveBeenCalledTimes(1);
});

it('does not reuse financial data after switching organization or account', async () => {
  const get = vi.spyOn(reportsApi, 'getFinancialStats').mockResolvedValue({} as Awaited<ReturnType<typeof reportsApi.getFinancialStats>>);
  const hook = renderHook(() => useFinancialReport(), { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  auth.user = { id: 'host-1', organizationId: 2 };
  hook.rerender();
  expect(hook.result.current.data).toBeNull();
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  auth.user = { id: 'host-2', organizationId: 2 };
  hook.rerender();
  expect(hook.result.current.data).toBeNull();
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(get).toHaveBeenCalledTimes(3);
});

it('waits for an authenticated account before requesting report data', () => {
  auth.user = null;
  const get = vi.spyOn(reportsApi, 'getFinancialStats');
  const hook = renderHook(() => useFinancialReport(), { wrapper: setup() });
  expect(hook.result.current.data).toBeNull();
  expect(hook.result.current.loading).toBe(true);
  expect(get).not.toHaveBeenCalled();
});

it('does not replace an unavailable payout list with zero financial amounts', async () => {
  vi.spyOn(reportViewsApi, 'execute').mockResolvedValue({ dimensions: ['PERIOD'], metrics: [], granularity: 'MONTH', from: '', to: '', currency: 'EUR', rows: [] });
  vi.spyOn(accountingApi, 'getPayouts').mockRejectedValue(new Error('offline'));
  const hook = renderHook(() => useDashboardRevenueSplit(), { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.data).toBeUndefined();
});

it('uses local month boundaries and excludes future payout periods', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 3, 12));
  const execute = vi.spyOn(reportViewsApi, 'execute').mockResolvedValue({ dimensions: ['PERIOD'], metrics: [], granularity: 'MONTH', from: '', to: '', currency: 'EUR', rows: [
    { dimensionValues: ['2026-10'], metrics: { REVENUE: 100, FEES: 10, MARGIN: 90 } },
  ] });
  vi.spyOn(accountingApi, 'getPayouts').mockResolvedValue([
    { periodStart: '2026-11-01', netAmount: 1000, status: 'PAID' } as OwnerPayout,
    { periodStart: '2026-10-01', netAmount: 20, status: 'PAID' } as OwnerPayout,
  ]);
  const hook = renderHook(() => useDashboardRevenueSplit(), { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-05-01', to: '2026-10-03' }));
  expect(hook.result.current.data).toHaveLength(1);
  expect(hook.result.current.data?.[0]).toMatchObject({ payout: 20, retained: 70 });
});
