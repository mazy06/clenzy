import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { reservationsApi, type Reservation } from '../../../services/api/reservationsApi';
import { useBaitlyPlanningPanelReservation } from '../hooks/useBaitlyPlanningPanelReservation';
import { planningKeys } from '../hooks/usePlanningData';

vi.mock('../../../services/api/reservationsApi', () => ({ reservationsApi: { getById: vi.fn() } }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('coordonnées à l’ouverture du panneau Baitly', () => {
  beforeEach(() => { vi.mocked(reservationsApi.getById).mockReset(); });

  it('ne lit aucune fiche complète au chargement de la grille, puis récupère le téléphone à l’ouverture', async () => {
    vi.mocked(reservationsApi.getById).mockResolvedValue({ id: 1, guestPhone: '+33123456789' } as Reservation);
    const { client, wrapper } = setup();
    const hook = renderHook(({ open }) => useBaitlyPlanningPanelReservation(1, open), { wrapper, initialProps: { open: false } });
    expect(reservationsApi.getById).not.toHaveBeenCalled();
    hook.rerender({ open: true });
    await waitFor(() => expect(hook.result.current.data?.guestPhone).toBe('+33123456789'));
    expect(reservationsApi.getById).toHaveBeenCalledTimes(1);
    hook.rerender({ open: false }); hook.rerender({ open: true });
    expect(reservationsApi.getById).toHaveBeenCalledTimes(1);
    await act(async () => { await client.invalidateQueries({ queryKey: planningKeys.all }); });
    await waitFor(() => expect(reservationsApi.getById).toHaveBeenCalledTimes(2));
    hook.unmount(); client.clear();
  });

  it('annule la fiche précédente quand une autre réservation est sélectionnée', async () => {
    const signals: AbortSignal[] = [];
    vi.mocked(reservationsApi.getById).mockImplementation((_id, signal) => {
      signals.push(signal!); return new Promise(() => {});
    });
    const { client, wrapper } = setup();
    const hook = renderHook(({ id }) => useBaitlyPlanningPanelReservation(id, true), { wrapper, initialProps: { id: 1 } });
    await waitFor(() => expect(signals).toHaveLength(1));
    hook.rerender({ id: 2 });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(hook.result.current.data).toBeUndefined();
    hook.unmount(); client.clear();
  });

  it('remonte l’erreur de la fiche sans fabriquer des coordonnées vides', async () => {
    vi.mocked(reservationsApi.getById).mockRejectedValue(new Error('lecture impossible'));
    const { client, wrapper } = setup();
    const hook = renderHook(() => useBaitlyPlanningPanelReservation(1, true), { wrapper });
    await waitFor(() => expect(hook.result.current.error?.message).toBe('lecture impossible'));
    expect(hook.result.current.data).toBeUndefined();
    hook.unmount(); client.clear();
  });
});
