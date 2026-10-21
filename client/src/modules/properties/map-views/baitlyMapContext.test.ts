import { expect, it } from 'vitest';
import { DEFAULT_MAP_CONTEXT, mapDateRange, normalizeMapContext, pointInMapScope, validMapDay } from './baitlyMapContext';

it('calcule demain et les sept jours sans décaler les dates aux changements de mois', () => {
  const now = new Date(2026, 9, 30, 15);
  expect(mapDateRange('tomorrow', '', '', now)).toEqual({ from: '2026-10-31', to: '2026-10-31' });
  expect(mapDateRange('week', '', '', now)).toEqual({ from: '2026-10-30', to: '2026-11-05' });
  expect(mapDateRange('all', '', '', now)).toEqual({});
});
it('rejette les jours impossibles et les périodes inversées', () => {
  expect(validMapDay('2026-02-30')).toBe(false);
  expect(mapDateRange('custom', '2026-10-18', '2026-10-16')).toEqual({});
  expect(mapDateRange('custom', '2026-10-16', '2026-10-18')).toEqual({ from: '2026-10-16', to: '2026-10-18' });
});
it('applique le vrai polygone sélectionné, même hors du cadrage, sans inclure ses trous', () => {
  const area: GeoJSON.Polygon = { type: 'Polygon', coordinates: [
    [[0,0],[4,0],[4,4],[0,4],[0,0]], [[1,1],[2,1],[2,2],[1,2],[1,1]],
  ] };
  const bounds = { north: 0.5, south: 0, west: 0, east: 0.5 };
  expect(pointInMapScope(3, 3, area, bounds)).toBe(true);
  expect(pointInMapScope(1.5, 1.5, area, bounds)).toBe(false);
  expect(pointInMapScope(3, 3, null, bounds)).toBe(false);
  expect(pointInMapScope(179, 0, null, { north: 10, south: -10, west: 170, east: -170 })).toBe(true);
  expect(pointInMapScope(0, 0, null, { north: 10, south: -10, west: 170, east: -170 })).toBe(false);
});
it('neutralise une ancienne préférence invalide sans transmettre une caméra NaN à MapLibre', () => {
  expect(normalizeMapContext({ camera: { center: [NaN, 3], zoom: 99, pitch: 0, bearing: 0 }, area: { lng: 999, lat: 0 } }))
    .toEqual(DEFAULT_MAP_CONTEXT);
});

it('conserve plusieurs points de sélection valides et filtre sur leur union', () => {
  const points = [{ lng: 2, lat: 48 }, { lng: 3, lat: 49 }];
  expect(normalizeMapContext({ area: [...points, { lng: 999, lat: 0 }] }).area).toEqual(points);
  expect(normalizeMapContext({ area: [] }).area).toBeNull();
  const area: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: [
    [[[0,0],[1,0],[1,1],[0,1],[0,0]]], [[[4,4],[5,4],[5,5],[4,5],[4,4]]],
  ] };
  expect(pointInMapScope(0.5, 0.5, area, null)).toBe(true);
  expect(pointInMapScope(4.5, 4.5, area, null)).toBe(true);
  expect(pointInMapScope(2, 2, area, null)).toBe(false);
});
