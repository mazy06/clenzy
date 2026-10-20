import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { browserPosition, useHomeMapCenter } from '../useHomeMapCenter';
import { STORAGE_KEYS } from '../../services/storageService';

vi.mock('../useIsAuthenticated', () => ({ useIsAuthenticated: () => true }));
vi.mock('../../services/api/usersApi', () => ({ usersApi: { getMyHomeLocation: async () => ({ longitude: -7.59, latitude: 33.57 }) } }));
beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { ...renderHook(useHomeMapCenter, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }), client };
}

describe('Localisation initiale Baitly', () => {
  it('donne priorité à la position actuelle même si le profil indique une autre ville', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { longitude: 51.53, latitude: 25.28 } } as GeolocationPosition) } });
    const { result } = mount();
    await waitFor(() => expect(result.current).toEqual([51.53, 25.28]));
  });

  it('utilise la ville du profil après un refus de géolocalisation', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) => failure({ code: 1 } as GeolocationPositionError) } });
    const { result } = mount();
    await waitFor(() => expect(result.current).toEqual([-7.59, 33.57]));
  });

  it('ne montre pas le profil pendant que le navigateur attend une décision', async () => {
    let refuse!: PositionErrorCallback;
    const locate = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => { refuse = failure; });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
    const { result } = mount();
    await waitFor(() => expect(locate).toHaveBeenCalledTimes(1));
    expect(result.current).toBeUndefined();
    await act(async () => refuse({ code: 1 } as GeolocationPositionError));
    await waitFor(() => expect(result.current).toEqual([-7.59, 33.57]));
  });

  it('rejette les coordonnées invalides et permet le repli sans Paris', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { longitude: NaN, latitude: 25 } } as GeolocationPosition) } });
    expect(await browserPosition()).toBeNull();
  });

  it.each(['granted', 'prompt'] as const)('ne sollicite qu’une fois un navigateur dont la permission est %s', async state => {
    const locate = vi.fn((success: PositionCallback) => success({ coords: { longitude: 2.3, latitude: 48.8 } } as GeolocationPosition));
    vi.stubGlobal('navigator', { permissions: { query: vi.fn(async () => ({ state })) }, geolocation: { getCurrentPosition: locate } });
    const first = mount();
    await waitFor(() => expect(first.result.current).toEqual([2.3, 48.8]));
    first.unmount();first.client.clear();
    const second = mount();
    await waitFor(() => expect(second.result.current).toEqual([-7.59, 33.57]));
    expect(locate).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STORAGE_KEYS.BROWSER_LOCATION_ATTEMPT)).toBe('1');
    expect(sessionStorage.length).toBe(1);
  });

  it('ne contacte pas la géolocalisation quand le navigateur indique denied', async () => {
    const locate = vi.fn();
    vi.stubGlobal('navigator', { permissions: { query: vi.fn(async () => ({ state: 'denied' })) }, geolocation: { getCurrentPosition: locate } });
    const { result } = mount();
    await waitFor(() => expect(result.current).toEqual([-7.59, 33.57]));
    expect(locate).not.toHaveBeenCalled();
  });

  it('partage une demande simultanée entre plusieurs cartes', async () => {
    let finish!: PositionCallback;
    const locate = vi.fn((success: PositionCallback) => { finish = success; });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
    const first = browserPosition();
    const second = browserPosition();
    expect(second).toBe(first);
    finish({ coords: { longitude: 2.3, latitude: 48.8 } } as GeolocationPosition);
    expect(await first).toEqual([2.3, 48.8]);
    expect(locate).toHaveBeenCalledTimes(1);
  });

  it('ne répète pas un refus après remontage ou rechargement du cache', async () => {
    const locate = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => failure({ code: 1 } as GeolocationPositionError));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
    expect(await browserPosition()).toBeNull();
    expect(await browserPosition()).toBeNull();
    expect(locate).toHaveBeenCalledTimes(1);
  });

  it('reste compatible avec une Permissions API qui refuse le descripteur', async () => {
    const locate = vi.fn((success: PositionCallback) => success({ coords: { longitude: 2.3, latitude: 48.8 } } as GeolocationPosition));
    vi.stubGlobal('navigator', { permissions: { query: vi.fn(async () => { throw new TypeError('Unsupported descriptor'); }) }, geolocation: { getCurrentPosition: locate } });
    expect(await browserPosition()).toEqual([2.3, 48.8]);
    expect(locate).toHaveBeenCalledTimes(1);
  });

  it('reste sur le profil sans boucle de sollicitation si le stockage est bloqué', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked storage'); });
    const locate = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
    const { result } = mount();
    await waitFor(() => expect(result.current).toEqual([-7.59, 33.57]));
    expect(locate).not.toHaveBeenCalled();
  });
});
