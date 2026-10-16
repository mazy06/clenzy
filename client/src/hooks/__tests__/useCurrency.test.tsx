import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const updatePreferencesMock = vi.fn(() => Promise.resolve());
let mockPreferences: { currency: string } = { currency: 'EUR' };
let mockIsLoaded = false;
let mockIsAuthenticated = true;

vi.mock('../useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: mockPreferences,
    isLoaded: mockIsLoaded,
    isLoading: false,
    isSaving: false,
    updatePreferences: updatePreferencesMock,
  }),
}));

vi.mock('../useIsAuthenticated', () => ({
  useIsAuthenticated: () => mockIsAuthenticated,
}));

// Empeche la query exchangeRateApi (non utile dans ces tests unitaires)
vi.mock('../../services/api/exchangeRateApi', () => ({
  exchangeRateApi: {
    getMatrix: vi.fn(() => Promise.resolve({ date: '2026-05-25', rates: {} })),
  },
}));

import { CurrencyProvider, useCurrency } from '../useCurrency';
import { exchangeRateApi } from '../../services/api/exchangeRateApi';
import i18n from '../../i18n/config';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CurrencyProvider>{children}</CurrencyProvider>
);

describe('useCurrency', () => {
  beforeEach(() => {
    window.localStorage.clear();
    updatePreferencesMock.mockClear();
    mockPreferences = { currency: 'EUR' };
    mockIsLoaded = false;
    mockIsAuthenticated = true;
    vi.mocked(exchangeRateApi.getMatrix).mockClear();
  });

  it('waits for authentication before requesting private rates, then loads them on login', async () => {
    mockIsAuthenticated = false;
    const { rerender } = renderHook(() => useCurrency(), { wrapper });
    expect(exchangeRateApi.getMatrix).not.toHaveBeenCalled();
    mockIsAuthenticated = true;
    rerender();
    await waitFor(() => expect(exchangeRateApi.getMatrix).toHaveBeenCalledTimes(1));
  });

  it('boots synchronously from localStorage to avoid flash', () => {
    window.localStorage.setItem('clenzy_currency', 'MAD');
    const { result } = renderHook(() => useCurrency(), { wrapper });
    expect(result.current.currency).toBe('MAD');
  });

  it('does NOT sync from backend until isLoaded is true (BUG-2)', () => {
    window.localStorage.setItem('clenzy_currency', 'MAD');
    mockPreferences = { currency: 'EUR' };
    mockIsLoaded = false;
    const { result } = renderHook(() => useCurrency(), { wrapper });
    expect(result.current.currency).toBe('MAD');
  });

  it('restores the saved euro preference instead of uploading a stale riyal cache', async () => {
    window.localStorage.setItem('clenzy_currency', 'SAR');
    mockPreferences = { currency: 'EUR' };
    mockIsLoaded = true;
    const { result } = renderHook(() => useCurrency(), { wrapper });
    await waitFor(() => {
      expect(result.current.currency).toBe('EUR');
    });
    expect(window.localStorage.getItem('clenzy_currency')).toBe('EUR');
    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });

  it('keeps the chosen euro when the interface language becomes Arabic', async () => {
    mockIsLoaded = true;
    const { result } = renderHook(() => useCurrency(), { wrapper });
    await act(async () => {
      i18n.emit('languageChanged', 'fr');
      i18n.emit('languageChanged', 'ar');
    });
    expect(result.current.currency).toBe('EUR');
    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });

  it('caches the loaded euro even if it matches the initial fallback', () => {
    mockIsLoaded = true;
    renderHook(() => useCurrency(), { wrapper });
    expect(window.localStorage.getItem('clenzy_currency')).toBe('EUR');
  });

  it('syncs backend value to local when isLoaded and backend != local', async () => {
    window.localStorage.setItem('clenzy_currency', 'EUR');
    mockPreferences = { currency: 'MAD' };
    mockIsLoaded = true;
    const { result } = renderHook(() => useCurrency(), { wrapper });
    await waitFor(() => {
      expect(result.current.currency).toBe('MAD');
    });
    expect(window.localStorage.getItem('clenzy_currency')).toBe('MAD');
  });

  it('setCurrency updates local + cache + pushes backend optimistically', async () => {
    mockPreferences = { currency: 'EUR' };
    mockIsLoaded = true;
    const { result } = renderHook(() => useCurrency(), { wrapper });

    act(() => {
      result.current.setCurrency('SAR');
    });

    expect(result.current.currency).toBe('SAR');
    expect(window.localStorage.getItem('clenzy_currency')).toBe('SAR');
    await waitFor(() => {
      expect(updatePreferencesMock).toHaveBeenCalledWith({ currency: 'SAR' });
    });
  });

  it('first-sync skipped when backend = EUR and local = EUR', () => {
    mockPreferences = { currency: 'EUR' };
    mockIsLoaded = true;
    renderHook(() => useCurrency(), { wrapper });
    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });

  it('rejects invalid currency code from backend', async () => {
    window.localStorage.setItem('clenzy_currency', 'EUR');
    mockPreferences = { currency: 'XXX' as string }; // invalide
    mockIsLoaded = true;
    const { result } = renderHook(() => useCurrency(), { wrapper });
    // Local 'EUR' preserve, backend value rejected by CURRENCY_OPTIONS check
    await waitFor(() => {
      expect(result.current.currency).toBe('EUR');
    });
  });
});
