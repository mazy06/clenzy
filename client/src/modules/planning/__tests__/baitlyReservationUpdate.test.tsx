import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useReservationUpdate } from '../hooks/useReservationUpdate';
import { reservationsApi } from '../../../services/api/reservationsApi';
import { planningKeys } from '../hooks/usePlanningData';

vi.mock('../../../services/api/reservationsApi', () => ({ reservationsApi: { update: vi.fn() } }));

describe('coordonnées voyageur dans le cache Baitly', () => {
  it('met à jour la réservation affichée avec la valeur réellement enregistrée par le serveur', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = [...planningKeys.all, 'data', 'test'];
    const interventions: unknown[] = [];
    client.setQueryData(key, { properties: [], interventions, reservations: [
      { id: 1, guestName: 'Alice', guestEmail: '' }, { id: 2, guestName: 'Bob', guestEmail: 'bob@example.com' },
    ] });
    vi.mocked(reservationsApi.update).mockResolvedValue({ id: 1, guestEmail: 'alice@example.com' } as never);
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useReservationUpdate([], []), { wrapper });
    await act(async () => {
      expect(await result.current.updateGuestInfo(1, { guestEmail: ' alice@example.com ' })).toEqual({ success: true, error: null });
    });
    const data = client.getQueryData<{ interventions: unknown[]; reservations: { id: number; guestEmail: string }[] }>(key)!;
    expect(data.reservations[0].guestEmail).toBe('alice@example.com');
    expect(data.reservations[1].guestEmail).toBe('bob@example.com');
    expect(data.interventions).toBe(interventions);
  });
});
