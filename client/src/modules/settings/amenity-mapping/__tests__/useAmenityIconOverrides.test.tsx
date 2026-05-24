import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmenityIconOverrides } from '../useAmenityIconOverrides';

const STORAGE_PREFIX = 'clenzy:amenity-icons:';

describe('useAmenityIconOverrides', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // ─── Read / initial state ───────────────────────────────────────────────────

  it('returns empty overrides for a fresh org', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    expect(result.current.overrides).toEqual({});
  });

  it('reads existing overrides from localStorage on mount', () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}42`, JSON.stringify({ WIFI: 'WifiHigh', POOL: 'WavesLadder' }));
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    expect(result.current.overrides).toEqual({ WIFI: 'WifiHigh', POOL: 'WavesLadder' });
  });

  it('returns empty for corrupted localStorage payload', () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}42`, 'not-valid-json');
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    expect(result.current.overrides).toEqual({});
  });

  it('returns empty if stored value is not a plain object (e.g. array)', () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}42`, JSON.stringify(['some', 'array']));
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    expect(result.current.overrides).toEqual({});
  });

  // ─── setIcon ────────────────────────────────────────────────────────────────

  it('setIcon adds an override and persists to localStorage', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));

    expect(result.current.overrides).toEqual({ WIFI: 'WifiHigh' });
    expect(JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}42`)!)).toEqual({ WIFI: 'WifiHigh' });
  });

  it('setIcon overwrites an existing override for the same code', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('WIFI', 'Router'));

    expect(result.current.overrides).toEqual({ WIFI: 'Router' });
  });

  it('setIcon preserves other overrides when adding a new one', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('POOL', 'WavesLadder'));

    expect(result.current.overrides).toEqual({ WIFI: 'WifiHigh', POOL: 'WavesLadder' });
  });

  // ─── resetIcon ──────────────────────────────────────────────────────────────

  it('resetIcon removes a specific override', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('POOL', 'WavesLadder'));
    act(() => result.current.resetIcon('WIFI'));

    expect(result.current.overrides).toEqual({ POOL: 'WavesLadder' });
  });

  it('resetIcon is a no-op when the code has no override', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));

    act(() => result.current.setIcon('POOL', 'WavesLadder'));
    act(() => result.current.resetIcon('WIFI'));

    expect(result.current.overrides).toEqual({ POOL: 'WavesLadder' });
  });

  // ─── resetAll ───────────────────────────────────────────────────────────────

  it('resetAll clears all overrides and the localStorage entry', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('POOL', 'WavesLadder'));
    act(() => result.current.resetAll());

    expect(result.current.overrides).toEqual({});
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}42`)).toBe('{}');
  });

  // ─── Per-org isolation ──────────────────────────────────────────────────────

  it('isolates overrides per organization (different orgIds → different storage keys)', () => {
    const { result: org42 } = renderHook(() => useAmenityIconOverrides(42));
    const { result: org99 } = renderHook(() => useAmenityIconOverrides(99));

    act(() => org42.current.setIcon('WIFI', 'WifiHigh'));

    expect(org42.current.overrides).toEqual({ WIFI: 'WifiHigh' });
    expect(org99.current.overrides).toEqual({});
  });

  it('falls back to "anon" key when orgId is null', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(null));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));

    expect(window.localStorage.getItem(`${STORAGE_PREFIX}anon`)).toContain('WifiHigh');
  });

  it('falls back to "anon" key when orgId is undefined', () => {
    const { result } = renderHook(() => useAmenityIconOverrides(undefined));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));

    expect(window.localStorage.getItem(`${STORAGE_PREFIX}anon`)).toContain('WifiHigh');
  });
});
