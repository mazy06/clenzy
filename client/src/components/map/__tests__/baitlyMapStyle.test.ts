import { afterEach, describe, expect, it } from 'vitest';
import { buildBaitlyMapStyle, composeBaitlyMapStyle, dayPeriodAt, BAITLY_NIGHT, BAITLY_PAPER } from '../baitlyMapStyle';

afterEach(() => {
  delete window.__baitlyConfig;
});

describe('buildBaitlyMapStyle', () => {
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
