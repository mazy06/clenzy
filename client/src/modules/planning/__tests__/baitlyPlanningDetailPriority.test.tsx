import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planningDataApi, type PlanningData } from '../../../services/api/planningDataApi';
import { useBaitlyReservationDetails } from '../hooks/useBaitlyReservationDetails';
import { getOverlappingChunks } from '../utils/dateUtils';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';

vi.mock('../../../services/api/planningDataApi', () => ({ planningDataApi: {
  getReservationDetails: vi.fn(),
} }));

const ids = [1];
const from = new Date(2026, 6, 28);
const to = new Date(2027, 0, 23);
const visible = { start: new Date(2026, 9, 4), end: new Date(2026, 10, 8) };
const empty: PlanningData = { reservations: [], interventions: [], awaitingPayment: [], blocked: [] };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('priorité des détails de réservation Baitly', () => {
  beforeEach(() => { vi.mocked(planningDataApi.getReservationDetails).mockReset(); });

  it('attend la fenêtre visible avant de démarrer les périodes voisines', async () => {
    const chunks = getOverlappingChunks(from, to, DATA_CHUNK_SIZE_DAYS);
    const current = chunks.find((c) => c.from <= '2026-10-04' && c.to >= '2026-11-08')!;
    let finish!: (data: PlanningData) => void;
    vi.mocked(planningDataApi.getReservationDetails).mockImplementation((_ids, start) =>
      start === current.from ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(empty));
    const { client, wrapper } = setup();
    const hook = renderHook(() => useBaitlyReservationDetails(ids, from, to, true, visible), { wrapper });
    await waitFor(() => expect(planningDataApi.getReservationDetails).toHaveBeenCalledTimes(1));
    expect(planningDataApi.getReservationDetails).toHaveBeenCalledWith(ids, current.from, current.to, expect.any(AbortSignal));
    expect(hook.result.current.priorityReady).toBe(false);
    await act(async () => finish(empty));
    await waitFor(() => expect(planningDataApi.getReservationDetails).toHaveBeenCalledTimes(chunks.length));
    expect(hook.result.current.priorityReady).toBe(true);
    hook.unmount(); client.clear();
  });

  it('priorise une nouvelle fenêtre et annule les lectures au démontage', async () => {
    const signals: AbortSignal[] = [];
    vi.mocked(planningDataApi.getReservationDetails).mockImplementation((_ids, _from, _to, signal) => {
      signals.push(signal!); return new Promise(() => {});
    });
    const { client, wrapper } = setup();
    const hook = renderHook(({ range }) => useBaitlyReservationDetails(ids, from, to, true, range),
      { wrapper, initialProps: { range: visible } });
    await waitFor(() => expect(signals).toHaveLength(1));
    hook.rerender({ range: { start: new Date(2026, 7, 10), end: new Date(2026, 7, 20) } });
    await waitFor(() => expect(signals).toHaveLength(2));
    hook.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    client.clear();
  });

  it('une erreur prioritaire ne bloque pas indéfiniment les voisins', async () => {
    vi.mocked(planningDataApi.getReservationDetails).mockRejectedValueOnce(new Error('lecture impossible'))
      .mockResolvedValue(empty);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useBaitlyReservationDetails(ids, from, to, true, visible), { wrapper });
    await waitFor(() => expect(planningDataApi.getReservationDetails).toHaveBeenCalledTimes(3));
    expect(hook.result.current.error).toBe('lecture impossible');
    hook.unmount(); client.clear();
  });
});
