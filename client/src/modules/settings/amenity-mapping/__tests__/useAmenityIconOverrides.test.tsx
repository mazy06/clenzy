import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mock IndexedDB cache ───────────────────────────────────────────────────
// jsdom n'a pas d'IndexedDB natif. On simule avec une Map in-memory pour
// tester la logique du hook sans dependre d'un vrai IDB.

const idbStore = new Map<string, unknown>();

vi.mock('../../../../services/indexedDbCache', () => ({
  idbCache: {
    get: vi.fn(async (key: string) => idbStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      idbStore.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      idbStore.delete(key);
    }),
    clear: vi.fn(async () => {
      idbStore.clear();
    }),
  },
}));

// ─── Mock amenity icon overrides API ────────────────────────────────────────
// Empeche les appels reseau (qui rejettent en jsdom) de polluer les
// assertions sur l'etat du hook.

vi.mock('../../../../services/api/amenityIconOverridesApi', () => ({
  amenityIconOverridesApi: {
    list: vi.fn(async () => []),
    upsert: vi.fn(async () => ({ amenityCode: '', iconName: '' })),
    delete: vi.fn(async () => undefined),
  },
}));

import { useAmenityIconOverrides } from '../useAmenityIconOverrides';

const CACHE_PREFIX = 'amenity-icons:';

describe('useAmenityIconOverrides', () => {
  beforeEach(() => {
    idbStore.clear();
    vi.clearAllMocks();
  });

  // ─── Read / initial state ───────────────────────────────────────────────────

  it('returns empty overrides for a fresh org', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => {
      expect(result.current.overrides).toEqual({});
    });
  });

  it('hydrates from IndexedDB cache on mount (when backend agrees)', async () => {
    idbStore.set(`${CACHE_PREFIX}42`, { WIFI: 'WifiHigh', POOL: 'WavesLadder' });
    // Le backend (source de verite) doit retourner les memes valeurs, sinon
    // la sync backend ecrase la cache locale (comportement attendu).
    const { amenityIconOverridesApi } = await import('../../../../services/api/amenityIconOverridesApi');
    (amenityIconOverridesApi.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { amenityCode: 'WIFI', iconName: 'WifiHigh' },
      { amenityCode: 'POOL', iconName: 'WavesLadder' },
    ]);
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => {
      expect(result.current.overrides).toEqual({ WIFI: 'WifiHigh', POOL: 'WavesLadder' });
    });
  });

  it('backend list (source of truth) overrides stale IDB cache', async () => {
    // Cache local desync : contient des donnees obsoletes
    idbStore.set(`${CACHE_PREFIX}42`, { WIFI: 'OldIcon' });
    const { amenityIconOverridesApi } = await import('../../../../services/api/amenityIconOverridesApi');
    (amenityIconOverridesApi.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { amenityCode: 'WIFI', iconName: 'NewIcon' },
    ]);
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    // L'etat final reflete le backend (source de verite)
    await waitFor(() => {
      expect(result.current.overrides).toEqual({ WIFI: 'NewIcon' });
    });
  });

  it('returns empty if IDB cache is corrupted (not a plain object)', async () => {
    idbStore.set(`${CACHE_PREFIX}42`, ['some', 'array']);
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    // Note : on attend que l'effect ait tourne mais l'array est rejete
    // par isValidPayload → l'etat reste a {}
    await waitFor(() => {
      expect(result.current.overrides).toEqual({});
    });
  });

  // ─── setIcon ────────────────────────────────────────────────────────────────

  it('setIcon adds an override and persists to IndexedDB', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));

    expect(result.current.overrides).toEqual({ WIFI: 'WifiHigh' });
    // L'ecriture IDB est async fire-and-forget — on lui laisse le temps
    await waitFor(() => {
      expect(idbStore.get(`${CACHE_PREFIX}42`)).toEqual({ WIFI: 'WifiHigh' });
    });
  });

  it('setIcon overwrites an existing override for the same code', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('WIFI', 'Router'));

    expect(result.current.overrides).toEqual({ WIFI: 'Router' });
  });

  it('setIcon preserves other overrides when adding a new one', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('POOL', 'WavesLadder'));

    expect(result.current.overrides).toEqual({ WIFI: 'WifiHigh', POOL: 'WavesLadder' });
  });

  // ─── resetIcon ──────────────────────────────────────────────────────────────

  it('resetIcon removes a specific override', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('POOL', 'WavesLadder'));
    act(() => result.current.resetIcon('WIFI'));

    expect(result.current.overrides).toEqual({ POOL: 'WavesLadder' });
  });

  it('resetIcon is a no-op when the code has no override', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('POOL', 'WavesLadder'));
    act(() => result.current.resetIcon('WIFI'));

    expect(result.current.overrides).toEqual({ POOL: 'WavesLadder' });
  });

  // ─── resetAll ───────────────────────────────────────────────────────────────

  it('resetAll clears all overrides and the IDB entry', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(42));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));
    act(() => result.current.setIcon('POOL', 'WavesLadder'));
    act(() => result.current.resetAll());

    expect(result.current.overrides).toEqual({});
    await waitFor(() => {
      expect(idbStore.get(`${CACHE_PREFIX}42`)).toEqual({});
    });
  });

  // ─── Per-org isolation ──────────────────────────────────────────────────────

  it('isolates overrides per organization (different orgIds → different cache keys)', async () => {
    const { result: org42 } = renderHook(() => useAmenityIconOverrides(42));
    const { result: org99 } = renderHook(() => useAmenityIconOverrides(99));
    await waitFor(() => {
      expect(org42.current.overrides).toEqual({});
      expect(org99.current.overrides).toEqual({});
    });

    act(() => org42.current.setIcon('WIFI', 'WifiHigh'));

    expect(org42.current.overrides).toEqual({ WIFI: 'WifiHigh' });
    expect(org99.current.overrides).toEqual({});
  });

  it('falls back to "anon" key when orgId is null', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(null));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));

    await waitFor(() => {
      expect(idbStore.get(`${CACHE_PREFIX}anon`)).toEqual({ WIFI: 'WifiHigh' });
    });
  });

  it('falls back to "anon" key when orgId is undefined', async () => {
    const { result } = renderHook(() => useAmenityIconOverrides(undefined));
    await waitFor(() => expect(result.current.overrides).toEqual({}));

    act(() => result.current.setIcon('WIFI', 'WifiHigh'));

    await waitFor(() => {
      expect(idbStore.get(`${CACHE_PREFIX}anon`)).toEqual({ WIFI: 'WifiHigh' });
    });
  });
});
