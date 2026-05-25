import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const updatePreferencesMock = vi.fn(() => Promise.resolve());
let mockPreferences: { themeMode: string } = { themeMode: 'auto' };
let mockIsLoaded = false;

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
  useIsAuthenticated: () => true,
}));

import { ThemeModeProvider, useThemeMode } from '../useThemeMode';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeModeProvider>{children}</ThemeModeProvider>
);

describe('useThemeMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    updatePreferencesMock.mockClear();
    mockPreferences = { themeMode: 'auto' };
    mockIsLoaded = false;
  });

  it('boots synchronously from localStorage to avoid FOUC', () => {
    window.localStorage.setItem('clenzy_theme_mode', 'dark');
    const { result } = renderHook(() => useThemeMode(), { wrapper });
    expect(result.current.mode).toBe('dark');
  });

  it('does NOT sync from backend until isLoaded is true (BUG-2)', () => {
    window.localStorage.setItem('clenzy_theme_mode', 'dark');
    mockPreferences = { themeMode: 'auto' }; // backend default
    mockIsLoaded = false; // backend pas encore charge
    const { result } = renderHook(() => useThemeMode(), { wrapper });
    // Local 'dark' preserve, pas overwrite par le default 'auto'
    expect(result.current.mode).toBe('dark');
  });

  it('first-sync: pushes local to backend if backend = default and local = explicit (BUG-3)', async () => {
    window.localStorage.setItem('clenzy_theme_mode', 'dark');
    mockPreferences = { themeMode: 'auto' };
    mockIsLoaded = true;
    renderHook(() => useThemeMode(), { wrapper });
    await waitFor(() => {
      expect(updatePreferencesMock).toHaveBeenCalledWith({ themeMode: 'dark' });
    });
  });

  it('syncs backend value to local when isLoaded and backend != local', async () => {
    window.localStorage.setItem('clenzy_theme_mode', 'light');
    mockPreferences = { themeMode: 'dark' };
    mockIsLoaded = true;
    const { result } = renderHook(() => useThemeMode(), { wrapper });
    await waitFor(() => {
      expect(result.current.mode).toBe('dark');
    });
    expect(window.localStorage.getItem('clenzy_theme_mode')).toBe('dark');
  });

  it('setMode updates local + cache + pushes backend optimistically', async () => {
    mockPreferences = { themeMode: 'auto' };
    mockIsLoaded = true;
    const { result } = renderHook(() => useThemeMode(), { wrapper });

    act(() => {
      result.current.setMode('dark');
    });

    expect(result.current.mode).toBe('dark');
    expect(window.localStorage.getItem('clenzy_theme_mode')).toBe('dark');
    await waitFor(() => {
      expect(updatePreferencesMock).toHaveBeenCalledWith({ themeMode: 'dark' });
    });
  });

  it('first-sync skipped when backend = default and local = default', () => {
    // Local = 'auto' (jamais explicitement set), backend = 'auto'
    mockPreferences = { themeMode: 'auto' };
    mockIsLoaded = true;
    renderHook(() => useThemeMode(), { wrapper });
    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });
});
