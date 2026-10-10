import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanningFilters } from '../hooks/usePlanningFilters';
import type { PlanningEvent, PlanningProperty } from '../types';

const preferences = vi.hoisted(() => ({ initial: null as unknown, write: vi.fn() }));
vi.mock('../../../hooks/useUserPreference', async () => {
  const { useState } = await import('react');
  return { useUserPreference: (_key: string, value: unknown) => {
    const [current, setCurrent] = useState(preferences.initial ?? value);
    return [current, (next: unknown) => { preferences.write(next); setCurrent(next); }];
  } };
});
beforeEach(() => { preferences.initial = null; preferences.write.mockClear(); });

const events = [
  { id: 'res-1', propertyId: 1, type: 'reservation', label: 'Alice', status: 'confirmed', reservation: { source: 'airbnb' } },
  { id: 'res-2', propertyId: 2, type: 'reservation', label: 'Bob', status: 'pending', reservation: { source: 'direct' } },
  { id: 'block-1', propertyId: 1, type: 'blocked', label: 'Indisponible' },
] as PlanningEvent[];
const properties = [{ id: 1 }, { id: 2 }] as PlanningProperty[];

describe('filtres unifiés du planning Baitly', () => {
  it('retrouve les canaux masqués après rechargement depuis la préférence backend', () => {
    const first = renderHook(() => usePlanningFilters(events, properties));
    act(() => first.result.current.toggleChannel('airbnb'));
    preferences.initial = preferences.write.mock.lastCall?.[0];
    first.unmount();
    const second = renderHook(() => usePlanningFilters(events, properties));
    expect(second.result.current.activeChannels.has('airbnb')).toBe(false);
    expect(second.result.current.filteredEvents.map((event) => event.id)).toEqual(['res-2', 'block-1']);
  });
  it('ne compte pas les préférences d’affichage comme des restrictions de données', () => {
    const { result } = renderHook(() => usePlanningFilters(events, properties));
    expect(result.current.filterCount).toBe(0);
    act(() => result.current.setShowPrices(false));
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('garde l’occupation et les canaux disponibles pendant une recherche ou un masquage', () => {
    const { result } = renderHook(() => usePlanningFilters(events, properties));
    act(() => result.current.toggleChannel('airbnb'));
    act(() => result.current.setSearchQuery('Bob'));
    expect(result.current.filteredEvents.map((event) => event.id)).toEqual(['res-2']);
    expect(result.current.occupancyEvents).toBe(events);
    expect(result.current.presentChannels.has('airbnb')).toBe(true);
    expect(result.current.filterCount).toBe(2);
    act(() => result.current.setPropertyFilter([1]));
    expect(result.current.occupancyEvents.map((event) => event.id)).toEqual(['res-1', 'block-1']);
  });

  it('permet de désélectionner tous les statuts puis de tout réinitialiser', () => {
    const { result } = renderHook(() => usePlanningFilters(events, properties));
    for (const status of [...result.current.activeStatuses]) act(() => result.current.toggleStatus(status));
    expect(result.current.activeStatuses.size).toBe(0);
    expect(result.current.filteredEvents.map((event) => event.id)).toEqual(['block-1']);
    act(() => result.current.clearFilters());
    expect(result.current.filteredEvents).toEqual(events);
    expect(result.current.filterCount).toBe(0);
  });

  it('conserve les indisponibilités quand les prestations sont masquées', () => {
    const { result } = renderHook(() => usePlanningFilters(events, properties));
    act(() => result.current.setShowInterventions(false));
    expect(result.current.filteredEvents.some((event) => event.type === 'blocked')).toBe(true);
  });
});
