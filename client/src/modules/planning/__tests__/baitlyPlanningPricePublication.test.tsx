import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarPricingApi, type CalendarPricingDayForProperty } from '../../../services/api/calendarPricingApi';
import { planningDataApi, type PlanningData } from '../../../services/api/planningDataApi';
import { usePlanningPricing } from '../hooks/usePlanningPricing';
import { useBaitlyReservationDetails } from '../hooks/useBaitlyReservationDetails';
import { useBaitlyPlanningPublication } from '../hooks/useBaitlyPlanningPublication';

vi.mock('../../../services/api/calendarPricingApi', () => ({ calendarPricingApi: { getPricingBatch: vi.fn() } }));
vi.mock('../../../services/api/planningDataApi', () => ({ planningDataApi: { getReservationDetails: vi.fn() } }));

const ids = [1];
const from = new Date(2026, 6, 28);
const to = new Date(2027, 0, 23);
const visible = { start: new Date(2026, 9, 4), end: new Date(2026, 10, 8) };
const empty: PlanningData = { reservations: [], interventions: [], awaitingPayment: [], blocked: [] };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('publication des prix et des séjours Baitly', () => {
  beforeEach(() => {
    vi.mocked(calendarPricingApi.getPricingBatch).mockReset();
    vi.mocked(planningDataApi.getReservationDetails).mockReset();
  });

  it.each(['prices', 'reservations'] as const)('attend les deux réponses lorsque %s arrive en premier', async (first) => {
    let finishPrices!: (data: CalendarPricingDayForProperty[]) => void;
    let finishReservations!: (data: PlanningData) => void;
    vi.mocked(calendarPricingApi.getPricingBatch).mockImplementation((_ids, start) => start === '2026-09-26'
      ? new Promise((resolve) => { finishPrices = resolve; }) : new Promise(() => {}));
    vi.mocked(planningDataApi.getReservationDetails).mockImplementation((_ids, start) => start === '2026-09-26'
      ? new Promise((resolve) => { finishReservations = resolve; }) : new Promise(() => {}));
    const { client, wrapper } = setup();
    const hook = renderHook(() => {
      const prices = usePlanningPricing(ids, from, to, true, visible);
      const details = useBaitlyReservationDetails(ids, from, to, true, visible);
      return useBaitlyPlanningPublication(prices.priorityReady && details.priorityReady);
    }, { wrapper });
    await waitFor(() => expect(finishPrices && finishReservations).toBeTruthy());
    expect(hook.result.current).toBe(false);
    await act(async () => first === 'prices' ? finishPrices([]) : finishReservations(empty));
    expect(hook.result.current).toBe(false);
    await act(async () => first === 'prices' ? finishReservations(empty) : finishPrices([]));
    await waitFor(() => expect(hook.result.current).toBe(true));
    // Les réponses voisines sont toujours en attente : elles ne retardent pas la grille visible.
    hook.unmount(); client.clear();
  });

  it('démarre les prix visibles avant les périodes voisines et transmet l’annulation', async () => {
    let finish!: (data: CalendarPricingDayForProperty[]) => void;
    const signals: AbortSignal[] = [];
    vi.mocked(calendarPricingApi.getPricingBatch).mockImplementation((_ids, start, _to, signal) => {
      signals.push(signal!);
      return start === '2026-09-26' ? new Promise((resolve) => { finish = resolve; }) : new Promise(() => {});
    });
    const { client, wrapper } = setup();
    const hook = renderHook(() => usePlanningPricing(ids, from, to, true, visible), { wrapper });
    await waitFor(() => expect(signals).toHaveLength(1));
    expect(hook.result.current.priorityReady).toBe(false);
    await act(async () => finish([]));
    await waitFor(() => expect(signals).toHaveLength(3));
    expect(hook.result.current.priorityReady).toBe(true);
    expect(hook.result.current.isLoading).toBe(true);
    hook.unmount();
    expect(signals.slice(1).every((signal) => signal.aborted)).toBe(true);
    client.clear();
  });

  it('signale un échec des prix sans bloquer indéfiniment les réservations', async () => {
    vi.mocked(calendarPricingApi.getPricingBatch).mockRejectedValue(new Error('Prix indisponibles'));
    const { client, wrapper } = setup();
    const hook = renderHook(() => usePlanningPricing(ids, from, to, true, visible), { wrapper });
    await waitFor(() => expect(hook.result.current.priorityReady).toBe(true));
    expect(hook.result.current.error).toBe('Prix indisponibles');
    hook.unmount(); client.clear();
  });

  it('ne charge ni n’attend les prix lorsque leur affichage est désactivé', () => {
    const { client, wrapper } = setup();
    const hook = renderHook(() => usePlanningPricing(ids, from, to, false, visible), { wrapper });
    expect(hook.result.current.priorityReady).toBe(true);
    expect(calendarPricingApi.getPricingBatch).not.toHaveBeenCalled();
    hook.unmount(); client.clear();
  });

  it('garde la grille publiée pendant une nouvelle lecture au scroll', async () => {
    const hook = renderHook(({ ready }) => useBaitlyPlanningPublication(ready), { initialProps: { ready: false } });
    expect(hook.result.current).toBe(false);
    hook.rerender({ ready: true });
    await waitFor(() => expect(hook.result.current).toBe(true));
    hook.rerender({ ready: false });
    expect(hook.result.current).toBe(true);
    hook.unmount();
  });
});
