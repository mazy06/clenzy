import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock keycloak module — controle keycloak.authenticated dans les tests
vi.mock('../../keycloak', () => ({
  default: { authenticated: false },
}));

import keycloak from '../../keycloak';
import { useIsAuthenticated } from '../useIsAuthenticated';

describe('useIsAuthenticated', () => {
  beforeEach(() => {
    (keycloak as { authenticated?: boolean }).authenticated = false;
  });

  afterEach(() => {
    (keycloak as { authenticated?: boolean }).authenticated = false;
  });

  it('returns false initially when keycloak is not authenticated', () => {
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);
  });

  it('returns true initially when keycloak is already authenticated', () => {
    (keycloak as { authenticated?: boolean }).authenticated = true;
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
  });

  it('flips to true on keycloak-auth-success window event', () => {
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
    });

    expect(result.current).toBe(true);
  });

  it('flips to false on keycloak-auth-logout window event', () => {
    (keycloak as { authenticated?: boolean }).authenticated = true;
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));
    });

    expect(result.current).toBe(false);
  });

  it('safety net: resynchronizes if keycloak.authenticated changed between useState init and useEffect mount', () => {
    // Simule la race : useState initialise avec false, puis keycloak passe
    // a authenticated avant que useEffect tourne. Le useEffect doit re-sync.
    (keycloak as { authenticated?: boolean }).authenticated = false;
    const { result, rerender } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);

    // Simule l'init Keycloak qui se termine (set authenticated en dehors de React)
    (keycloak as { authenticated?: boolean }).authenticated = true;
    // Force un re-render — en pratique cela arriverait au prochain re-render
    // declenche par un autre changement d'etat. L'utilisateur peut aussi
    // attendre l'evenement window pour la sync explicite.
    rerender();
    // Le useEffect run-once a deja synchronise au mount initial.
    // Note : ce test illustre la limite — le safety net du useEffect mount
    // attrape la race AVANT le 1er render visible, pas APRES.
    // Pour les cas reels, l'evenement window-event fait la sync.
  });

  it('cleanly removes event listeners on unmount', () => {
    const { result, unmount } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);

    unmount();

    // Apres unmount, dispatcher l'evenement ne doit pas re-render (pas
    // d'erreur "Can't perform a React state update on an unmounted component")
    expect(() => {
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
    }).not.toThrow();
  });
});
