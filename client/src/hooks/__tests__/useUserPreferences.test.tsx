import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const getMyPreferencesMock = vi.fn();
const updateMyPreferencesMock = vi.fn();

vi.mock('../../services/api/userPreferencesApi', () => ({
  default: {
    getMyPreferences: () => getMyPreferencesMock(),
    updateMyPreferences: (data: unknown) => updateMyPreferencesMock(data),
  },
}));

let mockIsAuthed = false;
vi.mock('../useIsAuthenticated', () => ({
  useIsAuthenticated: () => mockIsAuthed,
}));

import { useUserPreferences } from '../useUserPreferences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const SERVER_PREFS = {
  timezone: 'Europe/Paris',
  currency: 'MAD',
  language: 'ar',
  themeMode: 'dark',
  notifyEmail: false,
  notifyPush: true,
  notifySms: false,
};

describe('useUserPreferences', () => {
  beforeEach(() => {
    getMyPreferencesMock.mockReset();
    updateMyPreferencesMock.mockReset();
    mockIsAuthed = false;
  });

  describe('gating auth (BUG-1)', () => {
    it('does NOT fetch when not authenticated', async () => {
      mockIsAuthed = false;
      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });

      // Defaults retournes immediatement
      expect(result.current.preferences.currency).toBe('EUR');
      expect(result.current.preferences.themeMode).toBe('auto');
      expect(result.current.isLoaded).toBe(false);

      // Aucun appel reseau
      expect(getMyPreferencesMock).not.toHaveBeenCalled();
    });

    it('fetches when authenticated and exposes server data', async () => {
      mockIsAuthed = true;
      getMyPreferencesMock.mockResolvedValueOnce(SERVER_PREFS);

      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
      expect(result.current.preferences.currency).toBe('MAD');
      expect(result.current.preferences.themeMode).toBe('dark');
      expect(getMyPreferencesMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('isLoaded distinction (BUG-2)', () => {
    it('returns isLoaded=false during loading', () => {
      mockIsAuthed = true;
      getMyPreferencesMock.mockReturnValueOnce(new Promise(() => {})); // never resolves

      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });

      expect(result.current.isLoaded).toBe(false);
      expect(result.current.preferences).toEqual(expect.objectContaining({
        currency: 'EUR',
        themeMode: 'auto',
      }));
    });

    it('returns isLoaded=false when query errors (fallback to defaults)', async () => {
      mockIsAuthed = true;
      getMyPreferencesMock.mockRejectedValueOnce(new Error('500'));

      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(getMyPreferencesMock).toHaveBeenCalled();
      });
      // Apres l'erreur, isLoaded reste false, defaults retournes
      expect(result.current.isLoaded).toBe(false);
      expect(result.current.preferences.currency).toBe('EUR');
    });

    it('returns isLoaded=true after successful fetch', async () => {
      mockIsAuthed = true;
      getMyPreferencesMock.mockResolvedValueOnce(SERVER_PREFS);

      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });
  });

  describe('updatePreferences mutation', () => {
    it('calls API and updates cached preferences', async () => {
      mockIsAuthed = true;
      getMyPreferencesMock.mockResolvedValueOnce(SERVER_PREFS);
      updateMyPreferencesMock.mockResolvedValueOnce({ ...SERVER_PREFS, currency: 'SAR' });

      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      await act(async () => {
        await result.current.updatePreferences({ currency: 'SAR' });
      });

      expect(updateMyPreferencesMock).toHaveBeenCalledWith({ currency: 'SAR' });
      await waitFor(() => {
        expect(result.current.preferences.currency).toBe('SAR');
      });
    });

    it('isSaving reflects mutation pending state', async () => {
      mockIsAuthed = true;
      getMyPreferencesMock.mockResolvedValueOnce(SERVER_PREFS);
      let resolveMutation: (v: typeof SERVER_PREFS) => void;
      updateMyPreferencesMock.mockReturnValueOnce(
        new Promise((res) => { resolveMutation = res; })
      );

      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      expect(result.current.isSaving).toBe(false);
      act(() => { result.current.updatePreferences({ currency: 'SAR' }); });
      await waitFor(() => expect(result.current.isSaving).toBe(true));

      await act(async () => {
        resolveMutation!({ ...SERVER_PREFS, currency: 'SAR' });
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.isSaving).toBe(false));
    });
  });
});
