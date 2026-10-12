import { describe, expect, it } from 'vitest';
import type * as maplibregl from 'maplibre-gl';
import { BaitlySectorLayer, mergedSectorColor, sectorBounds, sectorColor, type SectorOverlay } from '../sectorLayer';

type Listener = () => void;

/** Carte minimale : sources, calques et événements, comme MapLibre une fois le style lu. */
function fakeMap() {
  const sources = new Map<string, { data: GeoJSON.FeatureCollection; setData(data: GeoJSON.FeatureCollection): void }>();
  const layers = new Map<string, Record<string, unknown>>();
  const listeners = new Map<string, Listener[]>();
  const map = {
    style: {},
    getStyle: () => ({ layers: [{ id: 'water', type: 'fill' }, { id: 'labels', type: 'symbol' }] }),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: { data: GeoJSON.FeatureCollection }) => {
      const entry = { data: source.data, setData(data: GeoJSON.FeatureCollection) { entry.data = data; } };
      sources.set(id, entry);
    },
    removeSource: (id: string) => sources.delete(id),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }, beforeId?: string) => layers.set(layer.id, { ...layer, beforeId }),
    removeLayer: (id: string) => layers.delete(id),
    on: (event: string, listener: Listener) => listeners.set(event, [...(listeners.get(event) ?? []), listener]),
    off: () => undefined,
    /** Remplacement de style par diff : nos sources et calques disparaissent. */
    replaceStyle: () => {
      sources.clear();
      layers.clear();
      listeners.get('styledata')?.forEach((listener) => listener());
    },
  };
  return { map, sources, layers };
}

const square = (lng: number): GeoJSON.Polygon => ({
  type: 'Polygon',
  coordinates: [[[lng, 48], [lng + 1, 48], [lng + 1, 49], [lng, 49], [lng, 48]]],
});

const overlay = (mode: SectorOverlay['mode']): SectorOverlay => ({
  providers: [{ id: 1, geometry: square(2) }, { id: 2, geometry: null }, { id: 3, geometry: square(3) }],
  merged: square(2),
  mode,
});

describe('BaitlySectorLayer', () => {
  it('whenMerged_thenOneOutlineInTheMergedColour', () => {
    const { map, sources } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set(overlay('merged'), 'light');

    const features = sources.get('baitly-sectors')!.data.features;
    expect(features).toHaveLength(1);
    expect(features[0].properties?.color).toBe(mergedSectorColor('light'));
  });

  it('whenByProvider_thenOneColourPerDrawableProvider', () => {
    const { map, sources } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set(overlay('byProvider'), 'dark');

    const colours = sources.get('baitly-sectors')!.data.features.map((f) => f.properties?.color);
    // La teinte suit le rang du prestataire, même quand un secteur intermédiaire n'est pas dessinable.
    expect(colours).toEqual([sectorColor(0, 'dark'), sectorColor(2, 'dark')]);
  });

  it('whenDrawn_thenLayersSitBelowTheFirstLabelLayer', () => {
    const { map, layers } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set(overlay('merged'), 'light');

    expect([...layers.keys()]).toEqual(['baitly-sectors-fill', 'baitly-sectors-casing', 'baitly-sectors-line']);
    expect([...layers.values()].every((layer) => layer.beforeId === 'labels')).toBe(true);
  });

  it('whenTheThemeSwapsTheStyle_thenTheSectorsAreRedrawn', () => {
    const { map, sources } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set(overlay('merged'), 'light');

    map.replaceStyle();

    expect(sources.get('baitly-sectors')).toBeDefined();
  });

  it('whenTheOverlayIsCleared_thenSourceAndLayersAreRemoved', () => {
    const { map, sources, layers } = fakeMap();
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    layer.set(overlay('merged'), 'light');

    layer.set(null, 'light');

    expect(sources.size).toBe(0);
    expect(layers.size).toBe(0);
  });

  it('whenAskedForBounds_thenTheExtentCoversEveryPart', () => {
    const multi: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: [square(2).coordinates, square(5).coordinates] };
    expect(sectorBounds(multi)).toEqual([2, 48, 6, 49]);
  });
});
