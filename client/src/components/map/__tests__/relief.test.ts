import { describe, expect, it, vi } from 'vitest';
import type * as maplibregl from 'maplibre-gl';
import { rememberReliefMode, setRelief } from '../relief';

function fakeMap(withTerrainSource = true) {
  const layers = new Set<string>(['water']);
  const map = {
    getSource: vi.fn((id: string) => (id === 'baitly-terrain' && withTerrainSource ? {} : undefined)),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    addLayer: vi.fn((layer: { id: string }) => { layers.add(layer.id); }),
    removeLayer: vi.fn((id: string) => { layers.delete(id); }),
    setTerrain: vi.fn(),
  };
  return { map: map as unknown as maplibregl.Map, layers, spies: map };
}

describe('setRelief', () => {
  it('ajoute terrain et ombrage sous l’eau en 3D, puis les retire à plat', () => {
    const { map, layers, spies } = fakeMap();
    rememberReliefMode(map, 'dark');

    setRelief(map, true);
    expect(spies.setTerrain).toHaveBeenLastCalledWith({ source: 'baitly-terrain', exaggeration: 1.15 });
    expect(spies.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'terrain_hillshade', type: 'hillshade' }), 'water');

    setRelief(map, false);
    expect(spies.setTerrain).toHaveBeenLastCalledWith(null);
    expect(layers.has('terrain_hillshade')).toBe(false);
  });

  it('ne fait rien sans source d’altitude', () => {
    const { map, spies } = fakeMap(false);
    setRelief(map, true);
    expect(spies.setTerrain).not.toHaveBeenCalled();
    expect(spies.addLayer).not.toHaveBeenCalled();
  });
});
