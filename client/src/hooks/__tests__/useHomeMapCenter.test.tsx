import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { browserPosition, useHomeMapCenter } from '../useHomeMapCenter';

vi.mock('../useIsAuthenticated', () => ({ useIsAuthenticated: () => true }));
vi.mock('../../services/api/usersApi', () => ({ usersApi: { getMyHomeLocation: async () => ({ longitude: -7.59, latitude: 33.57 }) } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(useHomeMapCenter, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
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
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } });
    const { result } = mount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeUndefined();
  });

  it('rejette les coordonnées invalides et permet le repli sans Paris', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { longitude: NaN, latitude: 25 } } as GeolocationPosition) } });
    expect(await browserPosition()).toBeNull();
  });
});
