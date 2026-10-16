import { act, cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_MAP_CONTEXT } from './baitlyMapContext';
import { useBaitlyMapContext } from './useBaitlyMapContext';

const pref = vi.hoisted(() => ({ loaded: false, value: {} as unknown, save: vi.fn() }));
vi.mock('../../../hooks/useUserPreference', () => ({ useUserPreference: () => [pref.value, pref.save, { isLoaded: pref.loaded }] }));
afterEach(() => { cleanup(); pref.loaded = false; pref.save.mockClear(); });

it('attend la réponse serveur avant de restaurer et ne remplace jamais une préférence par les défauts', () => {
  pref.value = { ...DEFAULT_MAP_CONTEXT, period: 'week', area: { lng: 2.3, lat: 48.8 } };
  const { result, rerender } = renderHook(() => useBaitlyMapContext('properties'), { wrapper: MemoryRouter });
  expect(pref.save).not.toHaveBeenCalled();
  act(() => { pref.loaded = true; }); rerender();
  expect(result.current.context.period).toBe('week');
  expect(result.current.context.area).toEqual({ lng: 2.3, lat: 48.8 });
  expect(pref.save).not.toHaveBeenCalled();
  act(() => result.current.patch({ quick: 'uncovered' }));
  expect(pref.save).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'week', quick: 'uncovered' }));
});
it('conserve un filtre choisi pendant le chargement et permet une réinitialisation explicite', () => {
  pref.value = { ...DEFAULT_MAP_CONTEXT, period: 'week' };
  const { result, rerender } = renderHook(() => useBaitlyMapContext('properties'), { wrapper: MemoryRouter });
  act(() => result.current.patch({ period: 'tomorrow' }));
  pref.loaded = true; rerender();
  expect(result.current.context.period).toBe('tomorrow');
  act(() => result.current.reset());
  expect(result.current.context).toEqual(DEFAULT_MAP_CONTEXT);
});
it('restaure la vue sauvegardée quand aucun onglet explicite ne figure dans l’URL', () => {
  pref.loaded = true;
  pref.value = { ...DEFAULT_MAP_CONTEXT, view: 'reservations' };
  const { result } = renderHook(() => {
    const [view, changeView] = useState<'properties' | 'prestations' | 'reservations' | 'issues'>('properties');
    return useBaitlyMapContext(view, changeView);
  }, { wrapper: MemoryRouter });
  expect(result.current.context.view).toBe('reservations');
  expect(pref.save).not.toHaveBeenCalledWith(DEFAULT_MAP_CONTEXT);
});
