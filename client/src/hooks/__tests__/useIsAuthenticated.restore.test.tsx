import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  keycloak: { authenticated: false },
  ready: Promise.resolve(false),
  init: Promise.resolve(false),
}));
vi.mock('../../keycloak', () => ({
  default: session.keycloak,
  get authReadyPromise() { return session.ready; },
  get keycloakInitPromise() { return session.init; },
}));
import { useIsAuthenticated } from '../useIsAuthenticated';

describe('useIsAuthenticated cookie session restoration', () => {
  let finishReady: (value: boolean) => void;
  let finishInit: (value: boolean) => void;
  beforeEach(() => {
    session.keycloak.authenticated = false;
    session.ready = new Promise((resolve) => { finishReady = resolve; });
    session.init = new Promise((resolve) => { finishInit = resolve; });
  });

  it('recognizes a cookie session restored after mounting without a login event', async () => {
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);
    await act(async () => {
      session.keycloak.authenticated = true;
      finishReady(true);
    });
    expect(result.current).toBe(true);
  });

  it('resynchronizes after the later SSO initialization finishes', async () => {
    const { result } = renderHook(() => useIsAuthenticated());
    await act(async () => { finishReady(false); });
    await act(async () => {
      session.keycloak.authenticated = true;
      finishInit(true);
    });
    expect(result.current).toBe(true);
  });

  it('does not restore a logged-out session from an old successful promise result', async () => {
    const { result } = renderHook(() => useIsAuthenticated());
    act(() => {
      session.keycloak.authenticated = true;
      window.dispatchEvent(new Event('keycloak-auth-success'));
    });
    expect(result.current).toBe(true);
    await act(async () => {
      session.keycloak.authenticated = false;
      window.dispatchEvent(new Event('keycloak-auth-logout'));
      finishReady(true);
      finishInit(true);
    });
    expect(result.current).toBe(false);
  });
});
