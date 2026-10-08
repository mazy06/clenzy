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

it('shows the full calendar year, fills missing months and excludes other years', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 3, 12));
  const execute = vi.spyOn(reportViewsApi, 'execute').mockResolvedValue({ dimensions: ['PERIOD'], metrics: [], granularity: 'MONTH', from: '', to: '', currency: 'EUR', rows: [
    { dimensionValues: ['2026-10'], metrics: { REVENUE: 100, FEES: 10, MARGIN: 90 } },
    { dimensionValues: ['2026-01'], metrics: { REVENUE: 500, FEES: 50, MARGIN: 400 } },
    { dimensionValues: ['2026-12'], metrics: { REVENUE: 200, FEES: 20, MARGIN: 160 } },
    { dimensionValues: ['2026-10'], metrics: { REVENUE: 50, FEES: 5, MARGIN: 40 } },
    { dimensionValues: ['2025-12'], metrics: { REVENUE: 9999 } },
  ] });
  vi.spyOn(accountingApi, 'getPayouts').mockResolvedValue([
    { periodStart: '2026-11-01', netAmount: 1000, status: 'PAID' } as OwnerPayout,
    { periodStart: '2026-10-01', netAmount: 20, status: 'PAID' } as OwnerPayout,
    { periodStart: '2026-10-01', netAmount: 999, status: 'FAILED' } as OwnerPayout,
    { periodStart: '2025-12-01', netAmount: 999, status: 'PAID' } as OwnerPayout,
    { periodStart: '2027-01-01', netAmount: 999, status: 'APPROVED' } as OwnerPayout,
  ]);
  const hook = renderHook(() => useDashboardRevenueSplit(), { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-01-01', to: '2026-12-31' }));
  const rows = hook.result.current.data!;
  expect(rows.map(row => row.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
  expect(rows[1]).toMatchObject({ currency: 'EUR', revenue: 0, fees: 0, interventions: 0, payout: 0, retained: 0 });
  expect(rows[9]).toMatchObject({ revenue: 150, fees: 15, interventions: 5, payout: 20, retained: 110 });
  expect(rows[10]).toMatchObject({ revenue: 0, payout: 1000, retained: -1000 });
  expect(rows.reduce((sum, row) => sum + row.revenue, 0)).toBe(850);
  expect(rows.reduce((sum, row) => sum + row.payout, 0)).toBe(1020);
  for (const row of rows) expect(row.fees + row.interventions + row.payout + row.retained).toBe(row.revenue);
});

it('keeps January through December visible for a year with no financial activity', async () => {
  const execute = vi.spyOn(reportViewsApi, 'execute').mockResolvedValue({ dimensions: ['PERIOD'], metrics: [], granularity: 'MONTH', from: '', to: '', currency: 'MAD', rows: [] });
  vi.spyOn(accountingApi, 'getPayouts').mockResolvedValue([]);
  const hook = renderHook(() => useDashboardRevenueSplit(2024), { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ from: '2024-01-01', to: '2024-12-31' }));
  expect(hook.result.current.data).toHaveLength(12);
  expect(hook.result.current.data?.every(row => row.currency === 'MAD' && row.revenue === 0 && row.payout === 0)).toBe(true);
});
