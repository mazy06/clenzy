import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAnalyticsEngine } from '../useAnalyticsEngine';
import { usePropertiesList } from '../usePropertiesList';
import { portfolioAnalyticsApi, type PortfolioAnalytics } from '../../services/api/portfolioAnalyticsApi';
import { reservationsApi } from '../../services/api/reservationsApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import * as compute from '../analyticsComputeFunctions';
import type { PricingMetrics, ForecastMetrics } from '../../types/analytics';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shares the property request and does not recompute projections when server aggregates arrive', async () => {
  let resolvePortfolio!: (value: PortfolioAnalytics) => void;
  vi.spyOn(portfolioAnalyticsApi, 'get').mockReturnValue(new Promise(resolve => { resolvePortfolio = resolve; }));
  vi.spyOn(reservationsApi, 'getAll').mockResolvedValue([]);
  const getProperties = vi.spyOn(propertiesApi, 'getAll').mockResolvedValue([]);
  vi.spyOn(propertiesApi, 'getPerformanceSummaries').mockResolvedValue([]);
  const pricing = vi.spyOn(compute, 'computePricingMetrics').mockReturnValue({} as PricingMetrics);
  const forecast = vi.spyOn(compute, 'computeForecast').mockReturnValue({} as ForecastMetrics);
  vi.spyOn(compute, 'computeRecommendations').mockReturnValue([]);
  vi.spyOn(compute, 'computeBusinessAlerts').mockReturnValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => ({ list: usePropertiesList(), analytics: useAnalyticsEngine({ period: 'month', interventions: [] }) }), { wrapper });
  await waitFor(() => expect(hook.result.current.list.isLoading).toBe(false));
  expect(getProperties).toHaveBeenCalledTimes(1);
  const pricingCalls = pricing.mock.calls.length;
  const forecastCalls = forecast.mock.calls.length;
  await act(async () => resolvePortfolio({ global: {}, revenue: {}, occupancy: {} } as PortfolioAnalytics));
  await waitFor(() => expect(hook.result.current.analytics.analytics).not.toBeNull());
  expect(pricing).toHaveBeenCalledTimes(pricingCalls);
  expect(forecast).toHaveBeenCalledTimes(forecastCalls);
  client.clear();
});

it('does not fetch or calculate when analytics are disabled', () => {
  const get = vi.spyOn(portfolioAnalyticsApi, 'get');
  const pricing = vi.spyOn(compute, 'computePricingMetrics');
  const forecast = vi.spyOn(compute, 'computeForecast');
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useAnalyticsEngine({ period: 'month', interventions: [], enabled: false }), { wrapper });
  expect(hook.result.current.analytics).toBeNull();
  expect(get).not.toHaveBeenCalled();
  expect(pricing).not.toHaveBeenCalled();
  expect(forecast).not.toHaveBeenCalled();
  client.clear();
});
