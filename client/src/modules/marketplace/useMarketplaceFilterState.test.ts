import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMarketplaceFilterState } from './useMarketplaceFilterState';

const state = vi.hoisted(() => ({ stored: undefined as unknown, loaded: false, loading: true, save: vi.fn() }));
vi.mock('../../hooks/useUserPreference', () => ({
  useUserPreference: (_key: string, initial: unknown) => [state.stored ?? initial, state.save,
    { isLoaded: state.loaded, isLoading: state.loading }],
}));
afterEach(() => { cleanup(); state.stored = undefined; state.loaded = false; state.loading = true; state.save.mockReset(); });

describe('Server-backed marketplace filters', () => {
  it('hydrates the server value without writing the initial default', () => {
    const { result, rerender } = renderHook(() => useMarketplaceFilterState('city', ''));
    expect(state.save).not.toHaveBeenCalled();
    state.stored = 'Paris'; state.loaded = true; state.loading = false;
    rerender();
    expect(result.current[0]).toBe('Paris');
    expect(state.save).not.toHaveBeenCalled();
    act(() => result.current[1]('Lyon'));
    expect(state.save).toHaveBeenCalledWith('Lyon');
  });

  it('composes multiple updates in the same event without dropping a selection', () => {
    state.loaded = true; state.stored = ['cleaning'];
    const { result } = renderHook(() => useMarketplaceFilterState<string[]>('categories', []));
    act(() => {
      result.current[1](previous => [...previous, 'laundry']);
      result.current[1](previous => [...previous, 'keys']);
    });
    expect(state.save).toHaveBeenLastCalledWith(['cleaning', 'laundry', 'keys']);
  });

  it('keeps a temporary filter during a load failure without overwriting unseen server data', () => {
    state.loading = false;
    const { result } = renderHook(() => useMarketplaceFilterState('city', ''));
    act(() => result.current[1]('Rabat'));
    expect(result.current[0]).toBe('Rabat');
    expect(state.save).not.toHaveBeenCalled();
  });

  it('falls back for an invalid stored collection', () => {
    state.loaded = true; state.stored = { category: 'cleaning' };
    const { result } = renderHook(() => useMarketplaceFilterState<string[]>('categories', []));
    expect(result.current[0]).toEqual([]);
    expect(state.save).not.toHaveBeenCalled();
  });
});
