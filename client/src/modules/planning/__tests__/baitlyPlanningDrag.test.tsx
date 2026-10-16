import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanningDrag } from '../hooks/usePlanningDrag';
import { interventionsApi } from '../../../services/api/interventionsApi';
import { reservationsApi } from '../../../services/api/reservationsApi';
import { planningKeys } from '../hooks/usePlanningData';
import type { PlanningEvent, DragBarData } from '../types';
import type { DragEndEvent } from '@dnd-kit/core';

const mocks = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }));
vi.mock('../../../hooks/useNotification', () => ({ useNotification: () => ({ notify: mocks }) }));
vi.mock('../../../services/api/interventionsApi', () => ({ interventionsApi: { update: vi.fn() } }));
vi.mock('../../../services/api/reservationsApi', () => ({ reservationsApi: { update: vi.fn() } }));

const reservation = { id: 'res-1', type: 'reservation', propertyId: 1, startDate: '2026-10-01', endDate: '2026-10-03', label: 'Alice', status: 'confirmed', color: '' } as PlanningEvent;
function setup(events: PlanningEvent[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = [...planningKeys.all, 'data', 'test'];
  const before = { reservations: [{ id: 1, checkIn: '2026-10-01', checkOut: '2026-10-03' }], interventions: [], properties: [] };
  client.setQueryData(key, before);
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => usePlanningDrag({ events, properties: [], interventions: [], days: [new Date(2026, 9, 1)], dayWidth: 80, density: 'normal' }), { wrapper });
  return { ...hook, client, key, before };
}
function drop(event: PlanningEvent, delta = 80): DragEndEvent {
  const data: DragBarData = { type: 'move', event, layout: { event, left: 0, top: 0, width: 80, height: 36, layer: 'primary' } };
  return { active: { id: event.id, data: { current: data } }, delta: { x: delta, y: 0 } } as unknown as DragEndEvent;
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(reservationsApi.update).mockResolvedValue({} as never); vi.mocked(interventionsApi.update).mockResolvedValue({} as never); });

describe('sauvegarde des déplacements Baitly', () => {
  it('sauvegarde réellement les dates des interventions', async () => {
    const intervention = { ...reservation, id: 'int-12', type: 'cleaning', startDate: '2026-10-04', endDate: '2026-10-04', startTime: '11:00', endTime: '14:00', intervention: { id: 12, startDate: '2026-10-04', endDate: '2026-10-04', startTime: '11:00', endTime: '14:00' } } as PlanningEvent;
    const { result } = setup([intervention]);
    await act(async () => { await result.current.handleDragEnd(drop(intervention)); });
    expect(interventionsApi.update).toHaveBeenCalledWith(12, { scheduledDate: '2026-10-05T11:00:00' });
  });
  it('restaure immédiatement les anciennes dates après un échec de sauvegarde', async () => {
    vi.mocked(reservationsApi.update).mockRejectedValue(new Error('Connexion interrompue'));
    const { result, client, key, before } = setup([reservation]);
    await act(async () => { await result.current.handleDragEnd(drop(reservation)); });
    expect(client.getQueryData(key)).toEqual(before);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Connexion interrompue'));
  });
  it('refuse le déplacement sur une période bloquée avec un retour utilisateur', async () => {
    const blocked = { ...reservation, id: 'block-1', type: 'blocked', startDate: '2026-10-03', endDate: '2026-10-05' } as PlanningEvent;
    const { result } = setup([reservation, blocked]);
    await act(async () => { await result.current.handleDragEnd(drop(reservation)); });
    expect(reservationsApi.update).not.toHaveBeenCalled();
    expect(mocks.warning).toHaveBeenCalled();
  });
  it('ne sauvegarde rien après un simple clic', async () => {
    const { result } = setup([reservation]);
    await act(async () => { await result.current.handleDragEnd(drop(reservation, 0)); });
    expect(reservationsApi.update).not.toHaveBeenCalled();
  });
});
