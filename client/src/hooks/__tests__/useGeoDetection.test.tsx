import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../services/storageService';
import { useGeoDetection } from '../useGeoDetection';

const { setCurrency, changeLanguage } = vi.hoisted(() => ({
  setCurrency: vi.fn(),
  changeLanguage: vi.fn(),
}));
vi.mock('../useCurrency', () => ({ useCurrency: () => ({ setCurrency }) }));
vi.mock('../useTranslation', () => ({ useTranslation: () => ({ changeLanguage }) }));

describe('useGeoDetection currency defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does not replace the euro preference loaded while geolocation is pending', async () => {
    let finishDetection!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finishDetection = resolve; })));
    renderHook(() => useGeoDetection());
    window.localStorage.setItem(STORAGE_KEYS.CURRENCY, 'EUR');
    await act(async () => { finishDetection(new Response(JSON.stringify({ country_code: 'SA' }))); });
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEYS.GEO_APPLIED)).toBe('true'));
    expect(setCurrency).not.toHaveBeenCalled();
  });

  it('still suggests a local currency for a new visitor without a preference', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ country_code: 'MA' }))));
    renderHook(() => useGeoDetection());
    await waitFor(() => expect(setCurrency).toHaveBeenCalledWith('MAD'));
  });
});
