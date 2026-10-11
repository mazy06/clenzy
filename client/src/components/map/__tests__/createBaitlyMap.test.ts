import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBaitlyMap } from '../createBaitlyMap';

const state = vi.hoisted(() => ({
  on: vi.fn(),
  once: vi.fn(),
  addControl: vi.fn(),
  removeLayer: vi.fn(),
  removeSource: vi.fn(),
  getSource: vi.fn(() => ({})),
  getStyle: () => ({ layers: [
    { id: 'regional-earth', source: 'protomaps' },
    { id: 'world-earth', source: 'baitly-world' },
    { id: 'world-labels', source: 'baitly-world' },
  ] }),
}));

vi.mock('maplibre-gl', () => ({
  Map: class { constructor() { return state; } },
  AttributionControl: class {},
  NavigationControl: class {},
}));
vi.mock('../mapRuntime', () => ({ ensureMapRuntime: vi.fn() }));
vi.mock('../baitlyMapStyle', () => ({
  buildBaitlyMapStyle: vi.fn(),
  dayPeriodAt: () => 'day',
  daylightFor: vi.fn(),
  TERRAIN_SOURCE_ID: 'baitly-terrain',
}));
vi.mock('../../../i18n/config', () => ({ default: { t: (_key: string, fallback: string) => fallback } }));
vi.mock('../../../utils/activeLocale', () => ({ activeLanguage: () => 'fr' }));

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe('Repli de la carte Baitly', () => {
  it('retire uniquement la source mondiale défaillante et ses calques', () => {
    vi.useFakeTimers();
    createBaitlyMap({ container: document.createElement('div'), mode: 'light', center: [2.35, 48.86], zoom: 12 });
    const errorHandler = state.on.mock.calls.find(([event]) => event === 'error')?.[1];
    errorHandler({ sourceId: 'protomaps' });
    expect(state.removeSource).not.toHaveBeenCalled();
    errorHandler({ sourceId: 'baitly-world' });
    expect(state.removeLayer.mock.calls).toEqual([['world-earth'], ['world-labels']]);
    expect(state.removeSource).toHaveBeenCalledWith('baitly-world');
  });
});
