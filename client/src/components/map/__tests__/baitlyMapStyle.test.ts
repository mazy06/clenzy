import { afterEach, describe, expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { buildBaitlyMapStyle, composeBaitlyMapStyle, dayPeriodAt, BAITLY_NIGHT, BAITLY_PAPER } from '../baitlyMapStyle';
import { MAP_PLACE_CATEGORIES, mapPlacesFilter } from '../baitlyMapPlaceCategories';

afterEach(() => {
  delete window.__baitlyConfig;
});

describe('buildBaitlyMapStyle', () => {
  it('accepts filters with every useful place category or none', () => {
    for (const selected of [[], MAP_PLACE_CATEGORIES.map(category => category.id)]) {
      const style = buildBaitlyMapStyle('light', 'fr');
      for (const layer of style.layers) {
        if (layer.type === 'symbol' && (layer.id === 'pois' || layer.id === 'world-pois')) layer.filter = mapPlacesFilter(selected);
      }
      expect(validateStyleMin(style).map(error => error.message)).toEqual([]);
    }
  });
  it('hides road numbers while retaining road names in both themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const style = buildBaitlyMapStyle(mode, 'fr');
      expect(style.layers.some((layer) => layer.id.includes('roads_shields'))).toBe(false);
      expect(style.layers.find((layer) => layer.id === 'roads_labels_minor')).toBeDefined();
      expect(style.layers.find((layer) => layer.id === 'roads_labels_major')).toBeDefined();
    }
  });
  it('produces valid worldwide styles in every supported language and theme', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const language of ['fr', 'en', 'ar'] as const) {
        expect(validateStyleMin(buildBaitlyMapStyle(mode, language)).map((error) => error.message)).toEqual([]);
      }
    }
  });
  it('whenNoRuntimeConfig_thenReadsTilesAndAssetsFromSameOrigin', () => {
    const style = buildBaitlyMapStyle('light', 'fr');

    const source = style.sources.protomaps as { url: string };
    expect(source.url).toBe(`pmtiles://${window.location.origin}/maps/baitly.pmtiles`);
    expect(style.glyphs).toBe(`${window.location.origin}/maps/assets/fonts/{fontstack}/{range}.pbf`);
    expect(style.sprite).toBe(`${window.location.origin}/maps/assets/sprites/baitly/light`);
  });

  it('whenRuntimeConfigPointsElsewhere_thenUsesIt', () => {
    window.__baitlyConfig = { VITE_MAP_TILES_URL: 'https://cartes.example/fr.pmtiles' };

    const source = buildBaitlyMapStyle('dark', 'fr').sources.protomaps as { url: string };

    expect(source.url).toBe('pmtiles://https://cartes.example/fr.pmtiles');
  });

  it('keeps a worldwide background below regional detail and above the style background', () => {
    const style = buildBaitlyMapStyle('light', 'fr');
    expect(style.sources['baitly-world']).toMatchObject({ type: 'vector', url: `pmtiles://${window.location.origin}/maps/world.pmtiles`, maxzoom: 6 });
    const firstWorld = style.layers.findIndex((layer) => layer.id.startsWith('world-'));
    const regionalEarth = style.layers.findIndex((layer) => layer.id === 'earth');
    expect(firstWorld).toBeGreaterThan(style.layers.findIndex((layer) => layer.type === 'background'));
    expect(firstWorld).toBeLessThan(regionalEarth);
    expect(style.layers.filter((layer) => layer.id.startsWith('world-') && layer.type !== 'symbol').every((layer) => layer.maxzoom === 24)).toBe(true);
  });

  it('whenDarkMode_thenPaintsNightPalette', () => {
    const style = buildBaitlyMapStyle('dark', 'en');

    const earth = style.layers.find((layer) => layer.id === 'earth');
    expect(earth && 'paint' in earth ? earth.paint : undefined).toMatchObject({ 'fill-color': BAITLY_NIGHT.earth });
    expect(style.sprite).toMatch(/sprites\/baitly\/dark$/);
  });

  it('whenArabic_thenLabelsReadArabicNames', () => {
    const style = buildBaitlyMapStyle('light', 'ar');

    const locality = style.layers.find((layer) => layer.id === 'places_locality');
    expect(JSON.stringify(locality)).toContain('name:ar');
  });

  it('whenBuilt_thenBuildingsFadeInWithOutline', () => {
    const style = buildBaitlyMapStyle('light', 'fr');

    const buildings = style.layers.find((layer) => layer.id === 'buildings');
    expect(buildings && 'paint' in buildings ? buildings.paint : undefined).toMatchObject({
      'fill-color': BAITLY_PAPER.buildings,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
    });
  });

  it('whenBuilt_thenBuildingsRiseIn3dBelowLabels', () => {
    const style = buildBaitlyMapStyle('light', 'fr');

    const index = style.layers.findIndex((layer) => layer.id === 'buildings-3d');
    const firstSymbol = style.layers.findIndex((layer) => layer.type === 'symbol');
    expect(style.layers[index]).toMatchObject({ type: 'fill-extrusion', minzoom: 14 });
    expect(index).toBe(firstSymbol - 1);
    expect(style.light).toBeDefined();
    expect(style.sky).toBeDefined();
  });

  it('whenStyleBuilt_thenShorelineFollowsWaterAndLabelsUseBaitlySans', () => {
    const style = buildBaitlyMapStyle('light', 'fr');

    const ids = style.layers.map((layer) => layer.id);
    expect(ids.indexOf('water_shoreline')).toBe(ids.indexOf('water') + 1);
    expect(JSON.stringify(style.layers)).toContain('Baitly Sans Regular');
  });

  it('whenTerrainProvided_thenHillshadeSitsUnderWater', () => {
    const style = composeBaitlyMapStyle('light', 'fr', { tiles: 'pmtiles://t', glyphs: 'g', sprite: 's', terrain: 'pmtiles://dem' });

    const ids = style.layers.map((layer) => layer.id);
    expect(style.sources['baitly-terrain']).toMatchObject({ type: 'raster-dem', encoding: 'terrarium' });
    expect(ids.indexOf('terrain_hillshade')).toBeLessThan(ids.indexOf('water'));
  });

  it('whenWebStyleBuilt_thenReliefSourceIsReadyButNotDrawnUntil3d', () => {
    const style = buildBaitlyMapStyle('light', 'fr');

    expect(style.sources['baitly-terrain']).toMatchObject({ type: 'raster-dem' });
    expect(style.layers.some((layer) => layer.id === 'terrain_hillshade')).toBe(false);
  });

  it('whenNoTerrain_thenNoHillshade', () => {
    const style = composeBaitlyMapStyle('light', 'fr', { tiles: 'pmtiles://t', glyphs: 'g', sprite: 's' });

    expect(style.layers.some((layer) => layer.id === 'terrain_hillshade')).toBe(false);
  });
});

describe('dayPeriodAt', () => {
  it('whenSameInstant_thenLightFollowsTheLongitude', () => {
    const instant = new Date('2026-10-10T16:00:00Z');

    expect(dayPeriodAt(instant, 2.35)).toBe('day'); // Paris : ~16 h solaire
    expect(dayPeriodAt(instant, 46.7)).toBe('dusk'); // Riyad : ~19 h solaire
    expect(dayPeriodAt(instant, -150)).toBe('dawn'); // ~6 h solaire
    expect(dayPeriodAt(new Date('2026-10-10T23:00:00Z'), 2.35)).toBe('night');
  });
});
