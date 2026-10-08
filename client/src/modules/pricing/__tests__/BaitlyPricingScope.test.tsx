// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDynamicPricing } from '../../../hooks/useDynamicPricing';
import { useTabKeyParam } from '../../../components/tabKeyParam';

vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../services/api/calendarPricingApi', () => ({ calendarPricingApi: { getPricing: vi.fn().mockResolvedValue([]), getRatePlans: vi.fn().mockResolvedValue([]) } }));
afterEach(cleanup);

function scope(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => ({ pricing: useDynamicPricing(), tab: useTabKeyParam([{ key: 'calendar' }, { key: 'strategy' }]) }), {
    wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>{children}</MemoryRouter></QueryClientProvider>,
  });
}

describe('Pricing scope across navigation', () => {
  it('preserves the selected property and calendar month when changing tabs', () => {
    const { result } = scope('/dynamic-pricing?owner=1&month=2026-10');
    act(() => result.current.pricing.setSelectedPropertyId(82));
    act(() => result.current.pricing.goToNextMonth());
    act(() => result.current.tab[1](1));
    expect(result.current.tab[0]).toBe(1);
    expect(result.current.pricing.selectedPropertyId).toBe(82);
    expect(result.current.pricing.from).toBe('2026-11-01');
    expect(result.current.pricing.to).toBe('2026-11-30');
  });
  it('rejects malformed property IDs and restores valid bookmarked dates', () => {
    const { result } = scope('/dynamic-pricing?property=-2&month=2027-02');
    expect(result.current.pricing.selectedPropertyId).toBeNull();
    expect(result.current.pricing.from).toBe('2027-02-01');
    expect(result.current.pricing.to).toBe('2027-02-28');
  });
});
