import { describe, expect, it, vi } from 'vitest';
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
    setPaintProperty: (id: string, property: string, value: unknown) => {
      const layer = layers.get(id);
      if (layer) layer.paint = { ...(layer.paint as Record<string, unknown>), [property]: value };
    },
    on: (event: string, listener: Listener) => listeners.set(event, [...(listeners.get(event) ?? []), listener]),
    off: () => undefined,
    /** Remplacement de style par diff : nos sources et calques disparaissent. */
    replaceStyle: () => {
      sources.clear();
      layers.clear();
      listeners.get('styledata')?.forEach((listener) => listener());
    },
  };
  return { map, sources, layers, listeners };
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
  it.each(['merged', 'byProvider'] as const)('toggles the same area off and switches from city to district in %s mode', mode => {
    const { map, listeners } = fakeMap();
    const select = vi.fn();
    const city = square(2);
    const district: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[2.1,48.1],[2.2,48.1],[2.2,48.2],[2.1,48.2],[2.1,48.1]]] };
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    const shown = { ...overlay(mode), providers: [{ id: 1, geometry: city }, { id: 3, geometry: district }], onAreaSelect: select };
    layer.set(shown, 'light');
    const click = listeners.get('click')![0] as unknown as (event: maplibregl.MapMouseEvent) => void;
    const at = (lng: number, lat: number) => click({ lngLat: { lng, lat } } as maplibregl.MapMouseEvent);
    at(2.5, 48.5);
    expect(select.mock.lastCall?.[1]).toEqual(city);
    layer.set({ ...shown, selectedAreaGeometry: JSON.parse(JSON.stringify(city)) }, 'light');
    at(2.7, 48.7);
    expect(select).toHaveBeenLastCalledWith(null, null, null);
    // Un arrondissement est une autre zone, même s'il appartient à la ville sélectionnée.
    at(2.15, 48.15);
    expect(select.mock.lastCall?.[1]).toEqual(district);
    layer.set({ ...shown, selectedAreaGeometry: JSON.parse(JSON.stringify(district)) }, 'light');
    at(2.18, 48.18);
    expect(select).toHaveBeenLastCalledWith(null, null, null);
    layer.set({ ...shown, selectedAreaGeometry: null }, 'light');
    at(2.18, 48.18);
    expect(select.mock.lastCall?.[1]).toEqual(district);
  });
  it.each(['merged', 'byProvider'] as const)('selects the district before its enclosing city in %s mode', mode => {
    const { map, listeners } = fakeMap();
    const select = vi.fn();
    const district: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[2.1, 48.1], [2.2, 48.1], [2.2, 48.2], [2.1, 48.2], [2.1, 48.1]]] };
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    // La grande ville arrive en dernier : l'ordre des prestataires ne doit pas gagner.
    layer.set({ ...overlay(mode), providers: [{ id: 3, geometry: district }, { id: 1, geometry: square(2) }], onAreaSelect: select }, 'light');
    const click = listeners.get('click')![0] as unknown as (event: maplibregl.MapMouseEvent) => void;
    click({ lngLat: { lng: 2.15, lat: 48.15 } } as maplibregl.MapMouseEvent);
    expect(select).toHaveBeenLastCalledWith([3, 1], district, { lng: 2.1499999999999773, lat: 48.15 });
    click({ lngLat: { lng: 2.5, lat: 48.5 } } as maplibregl.MapMouseEvent);
    expect(select).toHaveBeenLastCalledWith([3, 1], square(2), { lng: 2.5, lat: 48.5 });
  });
  it('filters overlapping providers on map clicks, preserves marker actions and releases its listener', () => {
    const { map, listeners } = fakeMap();
    const off = vi.spyOn(map, 'off');
    const select = vi.fn();
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    layer.set({ ...overlay('merged'), providers: [{ id: 1, geometry: square(2) }, { id: 3, geometry: square(2) }], onAreaSelect: select }, 'light');
    const click = listeners.get('click')![0] as unknown as (event: maplibregl.MapMouseEvent) => void;
    const event = (lng: number, target: Element = document.createElement('canvas')) => ({ lngLat: { lng, lat: 48.5 }, originalEvent: { target } }) as unknown as maplibregl.MapMouseEvent;
    click(event(2.5));
    expect(select).toHaveBeenLastCalledWith([1, 3], square(2), { lng: 2.5, lat: 48.5 });
    click(event(362.5));
    expect(select).toHaveBeenLastCalledWith([1, 3], square(2), { lng: 2.5, lat: 48.5 });
    const marker = document.createElement('button'); marker.className = 'maplibregl-marker';
    select.mockClear(); click(event(2.5, marker));
    expect(select).not.toHaveBeenCalled();
    click(event(8));
    expect(select).toHaveBeenLastCalledWith(null, null, null);
    layer.destroy();
    expect(off).toHaveBeenCalledWith('click', click);
  });

  it('keeps the clicked area filled while hovering a provider and removes it when the area is cleared', () => {
    const { map, sources } = fakeMap();
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    const selectedAreaGeometry = square(2);
    const shown = { ...overlay('byProvider'), selectedAreaGeometry };
    layer.set(shown, 'light');
    const focus = () => sources.get('baitly-sectors-focus')!.data.features;
    expect(focus()[0].geometry).toEqual(selectedAreaGeometry);
    expect(focus()[0].properties?.fillOpacity).toBeGreaterThan(0);
    layer.set({ ...shown, highlightedProviderId: 3 }, 'dark');
    expect(focus().some(feature => feature.geometry === selectedAreaGeometry)).toBe(true);
    layer.set({ ...shown, selectedAreaGeometry: null }, 'light');
    expect(focus()).toEqual([]);
  });
  it.each(['merged', 'byProvider'] as const)('whenSalmaIsSelected_thenOnlyHerContourIsVisibleIn%sMode', mode => {
    const { map, sources, layers } = fakeMap();
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    const shown = overlay(mode);
    layer.set(shown, 'light');
    const base = sources.get('baitly-sectors')!;
    const send = vi.spyOn(base, 'setData');
    const opacity = (id: string, key = 'line-opacity') => (layers.get(id)!.paint as Record<string, unknown>)[key];

    layer.set({ ...shown, selectedProviderId: 3 }, 'light');
    expect(opacity('baitly-sectors-line')).toBe(0);
    expect(opacity('baitly-sectors-casing')).toBe(0);
    expect(opacity('baitly-sectors-fill', 'fill-opacity')).toBe(0);
    expect(sources.get('baitly-sectors-focus')!.data.features.map(f => f.geometry)).toEqual([shown.providers[2].geometry]);
    expect(send).not.toHaveBeenCalled();

    layer.set({ ...shown, selectedProviderId: 3, highlightedProviderId: 1 }, 'light');
    expect(sources.get('baitly-sectors-focus')!.data.features.map(f => f.geometry)).toEqual([shown.providers[0].geometry]);
    layer.set({ ...shown, selectedProviderId: 3, highlightedProviderId: null }, 'light');
    expect(sources.get('baitly-sectors-focus')!.data.features.map(f => f.geometry)).toEqual([shown.providers[2].geometry]);

    // Le remplacement du style (thème/3D) conserve aussi l'isolation du secteur.
    map.replaceStyle();
    expect(opacity('baitly-sectors-line')).toBe(0);
    expect(sources.get('baitly-sectors-focus')!.data.features.map(f => f.geometry)).toEqual([shown.providers[2].geometry]);

    layer.set(shown, 'light');
    expect(opacity('baitly-sectors-line')).toEqual(['get', 'lineOpacity']);
    expect(opacity('baitly-sectors-fill', 'fill-opacity')).toEqual(['get', 'fillOpacity']);
    expect(sources.get('baitly-sectors-focus')!.data.features).toEqual([]);
  });

  it('doesNotShowOtherCoverageWhenTheSelectedProviderHasNoDrawableSector', () => {
    const { map, sources, layers } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set({ ...overlay('byProvider'), selectedProviderId: 2 }, 'dark');
    expect((layers.get('baitly-sectors-line')!.paint as Record<string, unknown>)['line-opacity']).toBe(0);
    expect(sources.get('baitly-sectors-focus')!.data.features).toEqual([]);
  });

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

  it('whenByProviderWithoutFocus_thenOutlinesOnlySoOverlapsDoNotDarkenTheMap', () => {
    const { map, sources } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set(overlay('byProvider'), 'light');

    const fills = sources.get('baitly-sectors')!.data.features.map((f) => f.properties?.fillOpacity);
    expect(fills).toEqual([0, 0]);
  });

  it('whenAProviderIsHovered_thenOnlyItsFilledSectorIsVisible', () => {
    const { map, sources, layers } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set({ ...overlay('byProvider'), highlightedProviderId: 1 }, 'light');

    const focus = sources.get('baitly-sectors-focus')!.data.features;
    expect(focus.map((f) => f.properties?.color)).toEqual([sectorColor(0, 'light')]);
    expect(focus[0].properties?.fillOpacity).toBeGreaterThan(0);
    expect((layers.get('baitly-sectors-line')!.paint as Record<string, unknown>)['line-opacity']).toBe(0);
    expect((layers.get('baitly-sectors-fill')!.paint as Record<string, unknown>)['fill-opacity']).toBe(0);
    // Les calques mis en avant sont posés après la base : ils se dessinent au-dessus.
    const ids = [...layers.keys()];
    expect(ids.indexOf('baitly-sectors-focus-line')).toBeGreaterThan(ids.indexOf('baitly-sectors-line'));
  });

  it('whenMergedWithAHoveredProvider_thenOnlyItsSectorIsVisibleUntilThePointerLeaves', () => {
    const { map, sources, layers } = fakeMap();
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    const shown = overlay('merged');
    layer.set({ ...shown, highlightedProviderId: 3 }, 'light');

    expect(sources.get('baitly-sectors')!.data.features.map((f) => f.properties?.color)).toEqual([mergedSectorColor('light')]);
    expect(sources.get('baitly-sectors-focus')!.data.features.map((f) => f.properties?.color)).toEqual([sectorColor(2, 'light')]);
    expect((layers.get('baitly-sectors-line')!.paint as Record<string, unknown>)['line-opacity']).toBe(0);
    layer.set(shown, 'light');
    expect((layers.get('baitly-sectors-line')!.paint as Record<string, unknown>)['line-opacity']).toEqual(['get', 'lineOpacity']);
    expect(sources.get('baitly-sectors-focus')!.data.features).toEqual([]);
  });

  it('whenOnlyTheFocusChanges_thenTheBaseIsNotSentAgain', () => {
    const { map, sources } = fakeMap();
    const layer = new BaitlySectorLayer(map as unknown as maplibregl.Map);
    const shown = overlay('byProvider');
    layer.set(shown, 'light');
    const base = sources.get('baitly-sectors')!;
    let baseSends = 0;
    const setData = base.setData.bind(base);
    base.setData = (data) => { baseSends += 1; setData(data); };

    layer.set({ ...shown, highlightedProviderId: 1 }, 'light');
    layer.set({ ...shown, highlightedProviderId: 3 }, 'light');

    expect(baseSends).toBe(0);
    expect(sources.get('baitly-sectors-focus')!.data.features).toHaveLength(1);
  });

  it('whenDrawn_thenLayersSitBelowTheFirstLabelLayer', () => {
    const { map, layers } = fakeMap();
    new BaitlySectorLayer(map as unknown as maplibregl.Map).set(overlay('merged'), 'light');

    expect([...layers.keys()]).toEqual([
      'baitly-sectors-fill', 'baitly-sectors-casing', 'baitly-sectors-line',
      'baitly-sectors-focus-fill', 'baitly-sectors-focus-casing', 'baitly-sectors-focus-line',
    ]);
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
