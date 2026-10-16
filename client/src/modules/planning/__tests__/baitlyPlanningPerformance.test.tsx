import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { calendarPricingApi } from '../../../services/api/calendarPricingApi';
import { usePlanningPricing } from '../hooks/usePlanningPricing';
import { usePlanningMinNights } from '../hooks/usePlanningMinNights';

vi.mock('../../../services/api/calendarPricingApi', () => ({
  calendarPricingApi: {
    getPricingBatch: vi.fn(async () => [{ propertyId: 1, date: '2026-10-10', nightlyPrice: 100 }]),
    getMinNightsOverridesBatch: vi.fn(async () => [{ propertyId: 1, date: '2026-10-10', minNights: 3 }]),
  },
}));

const ids = [1];
const start = new Date(2026, 9, 10);
const end = new Date(2026, 9, 11);

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('coût des rendus locaux du planning Baitly', () => {
  it('conserve les index de prix et de minimum de nuits sans reconstruire la grille', async () => {
    const { client, wrapper } = setup();
    const hook = renderHook(() => ({
      pricing: usePlanningPricing(ids, start, end, true),
      minimums: usePlanningMinNights(ids, start, end, true),
    }), { wrapper });
    await waitFor(() => expect(hook.result.current.pricing.pricingMap.get(1)?.get('2026-10-10')?.nightlyPrice).toBe(100));
    await waitFor(() => expect(hook.result.current.minimums.minNightsMap.get(1)?.get('2026-10-10')).toBe(3));
    const previous = hook.result.current;
    for (let i = 0; i < 20; i++) hook.rerender();
    expect(hook.result.current.pricing.pricingMap).toBe(previous.pricing.pricingMap);
    expect(hook.result.current.minimums.minNightsMap).toBe(previous.minimums.minNightsMap);
    act(() => client.setQueriesData({ queryKey: ['planning-pricing'] }, [
      { propertyId: 1, date: '2026-10-10', nightlyPrice: 125 },
    ]));
    await waitFor(() => expect(hook.result.current.pricing.pricingMap.get(1)?.get('2026-10-10')?.nightlyPrice).toBe(125));
    hook.unmount();
    client.clear();
  });

  it('transmet les signaux d’annulation et annule les lectures abandonnées', async () => {
    const signals: AbortSignal[] = [];
    const pending = (_ids: number[], _from: string, _to: string, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      return new Promise<never>(() => {});
    };
    vi.mocked(calendarPricingApi.getPricingBatch).mockImplementationOnce(pending);
    vi.mocked(calendarPricingApi.getMinNightsOverridesBatch).mockImplementationOnce(pending);
    const { client, wrapper } = setup();
    const hook = renderHook(() => {
      usePlanningPricing(ids, start, end, true);
      usePlanningMinNights(ids, start, end, true);
    }, { wrapper });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    hook.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    client.clear();
  });
});
