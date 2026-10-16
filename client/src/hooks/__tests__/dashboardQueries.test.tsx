import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDashboardOccupancyByProperty, useDashboardRevenueSplit } from '../useDashboardAnalyticsBlocks';
import { portfolioAnalyticsQuery, portfolioAnalyticsApi, type PortfolioAnalytics } from '../../services/api/portfolioAnalyticsApi';
import { reportsApi } from '../../services/api/reportsApi';
import { useFinancialReport } from '../../modules/reports/hooks/useReportData';
import { dashboardOverviewApi } from '../../services/api/dashboardOverviewApi';

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

it('requests one annual summary and shares it between widgets', async () => {
  const rows = [{ month: '2026-01', currency: 'EUR', revenue: 100, fees: 10, interventions: 20, payout: 30, retained: 40 }];
  const get = vi.spyOn(dashboardOverviewApi, 'getRevenueSplit').mockResolvedValue(rows);
  const hook = renderHook(() => [useDashboardRevenueSplit(2026), useDashboardRevenueSplit(2026)], { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.every(query => query.isSuccess)).toBe(true));
  expect(get).toHaveBeenCalledExactlyOnceWith(2026);
  expect(hook.result.current[0].data).toEqual(rows);
});

it('does not substitute zero amounts when the summary fails', async () => {
  vi.spyOn(dashboardOverviewApi, 'getRevenueSplit').mockRejectedValue(new Error('offline'));
  const hook = renderHook(() => useDashboardRevenueSplit(2026), { wrapper: setup() });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.data).toBeUndefined();
});

it('waits for authentication and isolates summaries by account, organization and year', async () => {
  auth.user = null;
  const get = vi.spyOn(dashboardOverviewApi, 'getRevenueSplit').mockResolvedValue([]);
  const hook = renderHook(({ year }) => useDashboardRevenueSplit(year), { initialProps: { year: 2026 }, wrapper: setup() });
  expect(get).not.toHaveBeenCalled();
  auth.user = { id: 'host-1', organizationId: 1 }; hook.rerender({ year: 2026 });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  auth.user = { id: 'host-1', organizationId: 2 }; hook.rerender({ year: 2026 });
  expect(hook.result.current.data).toBeUndefined();
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  auth.user = { id: 'host-2', organizationId: 2 }; hook.rerender({ year: 2026 });
  expect(hook.result.current.data).toBeUndefined();
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  hook.rerender({ year: 2025 });
  await waitFor(() => expect(get).toHaveBeenLastCalledWith(2025));
  expect(get).toHaveBeenCalledTimes(4);
});
