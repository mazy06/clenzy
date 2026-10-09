import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { usePropertyKpiSummaries } from './usePropertyKpiSummaries';
import { propertyKpiApi, type PropertyKpiSummary } from '../services/api/propertyKpiApi';

let user = { id: 'host', organizationId: 1 };
vi.mock('./useAuth', () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock('../services/api/propertyKpiApi', () => ({ propertyKpiApi: { getKpiSummaries: vi.fn() } }));
const row = { propertyId: 1, revenue: 100, occupancyRate: .5, adr: 50,
  operationalStatus: 'available', activeInterventionType: null } as PropertyKpiSummary;
let client: QueryClient;
beforeEach(() => {
  user = { id: 'host', organizationId: 1 };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(propertyKpiApi.getKpiSummaries).mockReset();
});
afterEach(() => client.clear());
const wrapper = ({ children }: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe('property KPI loading', () => {
  it('exposes initial loading and reuses recent data on return to the page', async () => {
    let resolve!: (rows: PropertyKpiSummary[]) => void;
    vi.mocked(propertyKpiApi.getKpiSummaries).mockReturnValue(new Promise(done => { resolve = done; }));
    const first = renderHook(() => usePropertyKpiSummaries([1]), { wrapper });
    expect(first.result.current.isLoading).toBe(true);
    expect(first.result.current.map.size).toBe(0);
    await act(async () => resolve([row]));
    await waitFor(() => expect(first.result.current.map.get(1)).toEqual(row));
    first.unmount();
    const second = renderHook(() => usePropertyKpiSummaries([1]), { wrapper });
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.map.get(1)).toEqual(row);
    expect(propertyKpiApi.getKpiSummaries).toHaveBeenCalledTimes(1);
  });

  it('never shows cached figures from another organization', async () => {
    vi.mocked(propertyKpiApi.getKpiSummaries).mockResolvedValueOnce([row]);
    const view = renderHook(() => usePropertyKpiSummaries([1]), { wrapper });
    await waitFor(() => expect(view.result.current.map.size).toBe(1));
    vi.mocked(propertyKpiApi.getKpiSummaries).mockReturnValue(new Promise(() => {}));
    user = { id: 'host', organizationId: 2 };
    view.rerender();
    expect(view.result.current.isLoading).toBe(true);
    expect(view.result.current.map.size).toBe(0);
  });
});
