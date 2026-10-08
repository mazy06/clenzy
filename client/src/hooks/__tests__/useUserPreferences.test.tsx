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
vi.mock('../../services/api/exchangeRateApi', () => ({
  exchangeRateApi: { getMatrix: vi.fn(async () => ({ date: '2026-10-05', rates: {} })) },
}));

import { useUserPreferences } from '../useUserPreferences';
import { CurrencyProvider, useCurrency } from '../useCurrency';

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
    it('keeps euro after a full remount even with an old riyal browser cache', async () => {
      mockIsAuthed = true;
      let stored = { ...SERVER_PREFS, currency: 'SAR' };
      getMyPreferencesMock.mockImplementation(async () => ({ ...stored }));
      updateMyPreferencesMock.mockImplementation(async (data) => {
        stored = { ...stored, ...data };
        return { ...stored };
      });
      const currencyWrapper = () => {
        const PreferencesWrapper = makeWrapper();
        return ({ children }: { children: React.ReactNode }) => (
          <PreferencesWrapper><CurrencyProvider>{children}</CurrencyProvider></PreferencesWrapper>
        );
      };
      const first = renderHook(() => useCurrency(), { wrapper: currencyWrapper() });
      await waitFor(() => expect(first.result.current.currency).toBe('SAR'));
      act(() => first.result.current.setCurrency('EUR'));
      await waitFor(() => expect(stored.currency).toBe('EUR'));
      first.unmount();
      // Simule un ancien onglet encore en SAR au moment du rechargement.
      window.localStorage.setItem('clenzy_currency', 'SAR');
      const second = renderHook(() => useCurrency(), { wrapper: currencyWrapper() });
      await waitFor(() => expect(second.result.current.currency).toBe('EUR'));
      expect(stored.currency).toBe('EUR');
      expect(updateMyPreferencesMock).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem('clenzy_currency')).toBe('EUR');
    });

    it('ignores a stale read that resolves after saving the new currency', async () => {
      mockIsAuthed = true;
      let finishOldRead!: (v: typeof SERVER_PREFS) => void;
      getMyPreferencesMock.mockReturnValueOnce(new Promise((resolve) => { finishOldRead = resolve; }));
      updateMyPreferencesMock.mockResolvedValueOnce({ ...SERVER_PREFS, currency: 'EUR' });
      const { result } = renderHook(() => useUserPreferences(), { wrapper: makeWrapper() });
      await waitFor(() => expect(getMyPreferencesMock).toHaveBeenCalledTimes(1));

      await act(async () => { await result.current.updatePreferences({ currency: 'EUR' }); });
      await waitFor(() => expect(result.current.preferences.currency).toBe('EUR'));
      await act(async () => { finishOldRead({ ...SERVER_PREFS, currency: 'SAR' }); });
      expect(result.current.preferences.currency).toBe('EUR');
    });

    it('serializes saves from separate preference controls to preserve both choices', async () => {
      mockIsAuthed = true;
      let stored = { ...SERVER_PREFS, currency: 'SAR' };
      getMyPreferencesMock.mockResolvedValue(stored);
      let finishCurrencySave!: () => void;
      updateMyPreferencesMock.mockImplementationOnce((data) => new Promise((resolve) => {
        finishCurrencySave = () => {
          stored = { ...stored, ...data };
          resolve(stored);
        };
      })).mockImplementationOnce(async (data) => {
        stored = { ...stored, ...data };
        return stored;
      });
      const { result } = renderHook(() => ({
        currencyControl: useUserPreferences(),
        themeControl: useUserPreferences(),
      }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.currencyControl.isLoaded).toBe(true));
      let currencySave!: Promise<unknown>;
      let themeSave!: Promise<unknown>;
      act(() => {
        currencySave = result.current.currencyControl.updatePreferences({ currency: 'EUR' });
        themeSave = result.current.themeControl.updatePreferences({ themeMode: 'light' });
      });
      await waitFor(() => expect(updateMyPreferencesMock).toHaveBeenCalledTimes(1));
      expect(updateMyPreferencesMock).toHaveBeenNthCalledWith(1, { currency: 'EUR' });
      await act(async () => {
        finishCurrencySave();
        await Promise.all([currencySave, themeSave]);
      });
      await waitFor(() => expect(result.current.currencyControl.preferences).toEqual(
        expect.objectContaining({ currency: 'EUR', themeMode: 'light' }),
      ));
      expect(updateMyPreferencesMock).toHaveBeenCalledTimes(2);
    });

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
