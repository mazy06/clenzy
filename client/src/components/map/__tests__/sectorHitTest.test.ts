import { describe, expect, it } from 'vitest';
import type { Polygon, MultiPolygon } from 'geojson';
import { sectorContainsPoint, sectorPartAtPoint, sectorProvidersAtPoint, sectorProvidersInArea, smallestSectorAtPoint } from '../sectorHitTest';

const square: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] };
const rectangle = (x: number, y: number, w: number, h: number): Polygon => ({
  type: 'Polygon', coordinates: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]],
});

describe('Prestataires de toute la zone sélectionnée', () => {
  const district = rectangle(1, 1, 1, 1);
  const providers = [
    { id: 1, geometry: square }, { id: 2, geometry: district },
    { id: 3, geometry: rectangle(2, 1, 1, 1) }, { id: 4, geometry: rectangle(10, 10, 1, 1) },
  ];
  it('inclut tous les arrondissements dans la ville, même loin du clic', () => {
    const area = smallestSectorAtPoint(providers, 3.5, 3.5)!;
    expect(sectorProvidersInArea(providers, area)).toEqual([1, 2, 3]);
  });
  it('inclut la couverture ville dans un arrondissement mais exclut le voisin qui partage son bord', () => {
    const area = smallestSectorAtPoint(providers, 1.5, 1.5)!;
    expect(sectorProvidersInArea(providers, area)).toEqual([1, 2]);
  });
  it('exclut les contacts par un sommet et les zones éloignées des multipolygones', () => {
    expect(sectorProvidersInArea([
      { id: 1, geometry: rectangle(2, 2, 1, 1) },
      { id: 2, geometry: { type: 'MultiPolygon', coordinates: [rectangle(8, 8, 1, 1).coordinates, rectangle(10, 10, 1, 1).coordinates] } },
      { id: 3, geometry: { type: 'MultiPolygon', coordinates: [district.coordinates, rectangle(10, 10, 1, 1).coordinates] } },
      { id: null, geometry: district }, { id: 4, geometry: null },
    ], district)).toEqual([3]);
  });
  it('détecte les polygones identiques, inversés et les recouvrements alignés', () => {
    expect(sectorProvidersInArea([
      { id: 1, geometry: district },
      { id: 2, geometry: { ...district, coordinates: district.coordinates.map(ring => [...ring].reverse()) } },
      { id: 3, geometry: rectangle(1.5, 1, 1, 1) },
    ], district)).toEqual([1, 2, 3]);
  });
  it('détecte les croisements sans sommet intérieur', () => {
    expect(sectorProvidersInArea([{ id: 1, geometry: rectangle(1, 0, 1, 4) }], rectangle(0, 1, 4, 1))).toEqual([1]);
  });
  it('respecte les trous, même lorsque leurs bords coïncident avec la zone sélectionnée', () => {
    const hollow: Polygon = { ...square, coordinates: [...square.coordinates, district.coordinates[0]] };
    for (const geometry of [hollow, { ...hollow, coordinates: hollow.coordinates.map(ring => [...ring].reverse()) }]) {
      expect(sectorProvidersInArea([{ id: 1, geometry }], district)).toEqual([]);
      expect(sectorProvidersInArea([{ id: 1, geometry: district }], geometry)).toEqual([]);
      expect(sectorProvidersInArea([{ id: 1, geometry }], rectangle(0.5, 0.5, 1, 1))).toEqual([1]);
    }
  });
});

describe('Filtre des prestataires au point cliqué', () => {
  it('prioritise l’arrondissement dans la ville, puis la ville hors de l’arrondissement, indépendamment de l’ordre', () => {
    const district: Polygon = { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]] };
    const providers = [{ id: 1, geometry: square }, { id: 2, geometry: district }];
    for (const order of [providers, [...providers].reverse()]) {
      expect(smallestSectorAtPoint(order, 1.5, 1.5)).toEqual(district);
      expect(sectorProvidersAtPoint(order, 1.5, 1.5).sort()).toEqual([1, 2]);
      expect(smallestSectorAtPoint(order, 3, 3)).toEqual(square);
      expect(sectorProvidersAtPoint(order, 3, 3)).toEqual([1]);
      expect(smallestSectorAtPoint(order, 8, 8)).toBeNull();
    }
  });
  it('retient tous les secteurs superposés, pas seulement le premier', () => {
    expect(sectorProvidersAtPoint([
      { id: 1, geometry: square }, { id: 2, geometry: square },
      { id: 3, geometry: null }, { id: null, geometry: square },
    ], 2, 2)).toEqual([1, 2]);
  });
  it('exclut les trous et les points dans une emprise mais hors du polygone', () => {
    const hole: Polygon = { ...square, coordinates: [...square.coordinates, [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]] };
    expect(sectorContainsPoint(hole, 2, 2)).toBe(false);
    expect(sectorContainsPoint(hole, 0.5, 0.5)).toBe(true);
    expect(sectorContainsPoint({ type: 'Polygon', coordinates: [[[0, 0], [4, 0], [0, 4], [0, 0]]] }, 3, 3)).toBe(false);
  });
  it('inclut les limites communes et chaque partie des multipolygones', () => {
    const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: [square.coordinates,
      [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]]] };
    expect(sectorContainsPoint(multi, 11, 11)).toBe(true);
    expect(sectorPartAtPoint(multi, 11, 11)).toEqual({ type: 'Polygon', coordinates: multi.coordinates[1] });
    expect(sectorContainsPoint(multi, 0, 2)).toBe(true);
    expect(sectorContainsPoint(multi, 6, 6)).toBe(false);
    expect(sectorContainsPoint(multi, NaN, 2)).toBe(false);
  });
});
