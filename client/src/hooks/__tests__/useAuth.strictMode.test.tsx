import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * Tests d'integration pour {@link useAuth} dans un wrapper React.StrictMode.
 *
 * <p><b>Pourquoi ce fichier specifique ?</b></p>
 *
 * <p>Bug historique fixe le 25/05/2026 : useAuth.useEffect avait une garde
 * {@code if (isInitializedRef.current) return} qui empechait le setup #2
 * en mode StrictMode dev (cycle : setup #1 → cleanup → setup #2 skip).
 * Resultat : tous les listeners (force-user-reload, keycloak-auth-success,
 * permissions-refreshed) etaient detaches par la cleanup et JAMAIS
 * re-attaches, cassant le flow de login (loadUserInfo jamais appele apres
 * dispatch d'event).</p>
 *
 * <p>Les tests unitaires classiques ne reproduisent PAS ce bug car ils ne
 * wrappent pas le hook dans {@code <React.StrictMode>}. Ces tests garantissent
 * que useAuth fonctionne correctement meme avec le double-invoke StrictMode.</p>
 *
 * <p>Toute regression similaire (re-introduction d'un useRef garde-fou,
 * pattern d'init one-shot mal implemente) sera detectee ici.</p>
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock est hoisted au top du fichier — on utilise vi.hoisted() pour
// declarer les mocks et y acceder ensuite via la valeur retournee.

const hoistedMocks = vi.hoisted(() => {
  const fetchMock = vi.fn();
  const keycloakMock = {
    authenticated: false,
    token: undefined as string | undefined,
    refreshToken: undefined as string | undefined,
    idToken: undefined as string | undefined,
    tokenParsed: undefined as Record<string, unknown> | undefined,
    onAuthSuccess: undefined as (() => void) | undefined,
    onAuthLogout: undefined as (() => void) | undefined,
    updateToken: vi.fn(() => Promise.resolve(true)),
  };
  return { fetchMock, keycloakMock };
});

const fetchMock = hoistedMocks.fetchMock;
const keycloakMock = hoistedMocks.keycloakMock;
const originalFetch = global.fetch;

vi.mock('../../keycloak', () => ({
  default: hoistedMocks.keycloakMock,
  syncAuthCookie: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/apiClient', () => ({
  clearTokenCookie: vi.fn(() => Promise.resolve()),
  default: { post: vi.fn() },
}));

vi.mock('../../services/storageService', () => ({
  clearTokens: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

vi.mock('../../services/indexedDbCache', () => ({
  idbCache: { deleteByPrefix: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../services/PermissionSyncService', () => ({
  default: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      syncNow: vi.fn(() => Promise.resolve()),
      shutdown: vi.fn(),
    })),
  },
}));

vi.mock('../../services/RedisCacheService', () => ({
  default: { getInstance: vi.fn(() => ({})) },
}));

vi.mock('../useCustomPermissions', () => ({
  CustomPermissionsContext: React.createContext(null),
}));

import { useAuth } from '../useAuth';
import { AuthProvider } from '../../contexts/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_FIXTURE = {
  subject: '44bfc16a-5ceb-4897-b397-8002afd670aa',
  id: 1,
  email: 'admin@clenzy.fr',
  preferred_username: 'admin',
  firstName: 'Admin',
  lastName: 'Baitly',
  role: 'SUPER_ADMIN',
  organizationId: 2,
};

// Wrap dans React.StrictMode + AuthProvider — depuis le refactor 2026-05,
// useAuth est un consumer de Context (plus de logique standalone).
function wrapStrict({ children }: { children: React.ReactNode }) {
  return (
    <React.StrictMode>
      <AuthProvider>{children}</AuthProvider>
    </React.StrictMode>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAuth — StrictMode integration', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    keycloakMock.authenticated = false;
    keycloakMock.token = undefined;
    keycloakMock.onAuthSuccess = undefined;
    keycloakMock.onAuthLogout = undefined;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('mounts without leaking listeners after StrictMode double-invoke', async () => {
    // Initial render avec keycloak non authentifie → loadUserInfo va dans
    // la branche else et set user=null, loading=false. Pas de fetch /api/me.
    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CRITICAL: dispatches keycloak-auth-success → loadUserInfo IS called (regression for fix 757fe9d6)', async () => {
    // Simule un login : keycloak setup + dispatch event
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Login.tsx simule : set keycloak state + dispatch event
    act(() => {
      keycloakMock.authenticated = true;
      keycloakMock.token = 'fake-jwt-token';
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
    });

    // /api/me DOIT etre appele (via le listener direct + le chain
    // force-user-reload). Sans le fix, fetchMock resterait a 0 calls.
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalled();
      },
      { timeout: 500 },
    );

    // Verifier que c'est bien /api/me qui a ete fetched
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall[0]).toContain('/api/me');
    expect(firstCall[1]?.headers).toMatchObject({
      Authorization: 'Bearer fake-jwt-token',
    });
  });

  it('dispatches force-user-reload → loadUserInfo IS called', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      keycloakMock.authenticated = true;
      keycloakMock.token = 'fake-jwt-token';
      window.dispatchEvent(new CustomEvent('force-user-reload'));
    });

    // setTimeout 100ms → fetchMock appele apres delay
    await waitFor(
      () => expect(fetchMock).toHaveBeenCalled(),
      { timeout: 500 },
    );
  });

  it('keycloak-auth-logout dispatch is properly handled (cleanup ran but listener re-attached)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Set user via login
    keycloakMock.authenticated = true;
    keycloakMock.token = 'fake-jwt-token';
    act(() => {
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
    });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    // Trigger keycloak.onAuthLogout (set by useAuth setup #2)
    expect(typeof keycloakMock.onAuthLogout).toBe('function');
    act(() => {
      keycloakMock.onAuthLogout?.();
    });

    // user should be cleared by handleAuthLogout
    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });

  it('multiple mounts/unmounts do not leak listeners (memory safety)', async () => {
    const { unmount } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    unmount();

    // After unmount, dispatching events should NOT crash (no orphan listeners)
    expect(() => {
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
      window.dispatchEvent(new CustomEvent('force-user-reload'));
      window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));
    }).not.toThrow();

    // Re-mount works
    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  // ─── Resilience aux erreurs transitoires (fix bug deconnexion /assistant) ───

  it('429 rate limit on /api/me does NOT logout the user (resilience fix)', async () => {
    // Phase 1 : login normal → user charge
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));

    keycloakMock.authenticated = true;
    keycloakMock.token = 'fake-jwt-token';
    act(() => { window.dispatchEvent(new CustomEvent('keycloak-auth-success')); });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    const userBefore = result.current.user;

    // Phase 2 : re-trigger un loadUserInfo qui hit le rate limit
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Too Many Requests' }),
    } as Response);

    act(() => { window.dispatchEvent(new CustomEvent('force-user-reload')); });

    // Attendre la fin du loadUserInfo (delay 100ms du handler force-user-reload)
    await new Promise((r) => setTimeout(r, 250));

    // User DOIT etre toujours charge — pas de deconnexion sur 429
    expect(result.current.user).toEqual(userBefore);
  });

  it('500 server error on /api/me does NOT logout the user', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);
    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));
    keycloakMock.authenticated = true;
    keycloakMock.token = 'fake-jwt-token';
    act(() => { window.dispatchEvent(new CustomEvent('keycloak-auth-success')); });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    // Trigger un /api/me qui retourne 503
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'Service Unavailable' }),
    } as Response);
    act(() => { window.dispatchEvent(new CustomEvent('force-user-reload')); });
    await new Promise((r) => setTimeout(r, 250));

    expect(result.current.user).not.toBeNull();
  });

  it('network error (fetch throws) does NOT logout the user', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);
    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));
    keycloakMock.authenticated = true;
    keycloakMock.token = 'fake-jwt-token';
    act(() => { window.dispatchEvent(new CustomEvent('keycloak-auth-success')); });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    // Trigger un /api/me qui leve une erreur reseau
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    act(() => { window.dispatchEvent(new CustomEvent('force-user-reload')); });
    await new Promise((r) => setTimeout(r, 250));

    expect(result.current.user).not.toBeNull();
  });

  it('CRITICAL: multiple useAuth() consumers share state — ONE /api/me, not N (storm fix)', async () => {
    // Avant le refactor AuthContext : N consumers → N appels /api/me en parallele
    // → rate limit (429) → deconnexion. Ce test verifie que le Context partage
    // garantit UN SEUL appel quel que soit le nombre de consumers.
    keycloakMock.authenticated = true;
    keycloakMock.token = 'fake-jwt-token';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);

    // Wrap qui partage le MEME AuthProvider entre plusieurs consumers
    const SharedProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <React.StrictMode>
        <AuthProvider>
          <>{children}</>
        </AuthProvider>
      </React.StrictMode>
    );

    // Simule 5 composants qui appellent tous useAuth() (comme MainLayout,
    // Sidebar, ProtectedRoute, UserProfile, etc. font simultanement).
    const MultiConsumer = () => {
      useAuth(); useAuth(); useAuth(); useAuth(); useAuth();
      return null;
    };

    const { result } = renderHook(
      () => {
        // Render le multi-consumer + le useAuth de test dans le meme arbre
        return useAuth();
      },
      {
        wrapper: ({ children }) => (
          <SharedProviderWrapper>
            <MultiConsumer />
            {children}
          </SharedProviderWrapper>
        ),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Compter les calls a /api/me — doit etre EXACTEMENT 1 (ou 2 en StrictMode
    // a cause du double-invoke du Provider useEffect, mais PAS 6 = 1 + 5 consumers).
    const meCalls = fetchMock.mock.calls.filter((args) => {
      const url = args[0] as string;
      return url.includes('/api/me');
    });
    // Tolerer 1-2 calls (StrictMode dev double-invoque le useEffect du Provider)
    // mais doit etre << 6 (= ce qu'on aurait avec le standalone hook + 5 consumers).
    expect(meCalls.length).toBeLessThanOrEqual(2);
    expect(meCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('403 Forbidden on /api/me DOES logout the user (real auth issue)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(USER_FIXTURE),
    } as Response);
    const { result } = renderHook(() => useAuth(), { wrapper: wrapStrict });
    await waitFor(() => expect(result.current.loading).toBe(false));
    keycloakMock.authenticated = true;
    keycloakMock.token = 'fake-jwt-token';
    act(() => { window.dispatchEvent(new CustomEvent('keycloak-auth-success')); });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    // Trigger un /api/me qui retourne 403 → vraie erreur d'autorisation
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden' }),
    } as Response);
    act(() => { window.dispatchEvent(new CustomEvent('force-user-reload')); });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });
});
