import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useDashboardOverview } from '../useDashboardOverview';
import type { DashboardOverviewSummary } from '../../services/api/dashboardOverviewApi';

const getSummary = vi.hoisted(() => vi.fn());
vi.mock('../../services/api/dashboardOverviewApi', () => ({ dashboardOverviewApi: { getSummary } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('revérifie un portefeuille vide au retour de la création, même immédiatement', async () => {
  const empty: DashboardOverviewSummary = {
    properties: { total: 0, active: 0, growth: 0 },
    occupancyRate: { value: 0, growth: 0 }, totalRevenue: { value: 0, growth: 0 },
    adr: { value: 0, growth: 0 }, revPan: { value: 0, growth: 0 }, bookings: { value: 0, growth: 0 },
    guestRating: { average: 0, count: 0 }, serviceRequests: { total: 0, pending: 0 },
    interventions: { today: 0, total: 0, growth: 0, upcoming: 0, completed: 0, completionRate: 0, totalRevenue: 0 },
    urgentInterventionsCount: 0, pendingPaymentsCount: 0,
  };
  getSummary.mockResolvedValueOnce(empty).mockResolvedValue({ ...empty, properties: { total: 1, active: 1, growth: 0 } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const firstVisit = renderHook(() => useDashboardOverview({ period: 'month', t: (key) => key }), { wrapper });
  await waitFor(() => expect(firstVisit.result.current.stats?.properties.total).toBe(0));
  firstVisit.unmount();

  const returnVisit = renderHook(() => useDashboardOverview({ period: 'month', t: (key) => key }), { wrapper });
  await waitFor(() => expect(returnVisit.result.current.stats?.properties.total).toBe(1));
  expect(getSummary).toHaveBeenCalledTimes(2);
  returnVisit.unmount();
  client.clear();
});
