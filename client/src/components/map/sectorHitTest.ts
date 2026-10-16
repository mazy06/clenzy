import type { Polygon, Position } from 'geojson';
import type { SectorGeometry } from './sectorLayer';

/** -1 dehors, 0 sur le bord, 1 dedans. Les limites communes appartiennent aux deux secteurs. */
function inRing(lng: number, lat: number, ring: Position[]): -1 | 0 | 1 {
  let inside = false;
  const epsilon = 1e-10;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const cross = (lng - ax) * (by - ay) - (lat - ay) * (bx - ax);
    if (Math.abs(cross) <= epsilon && lng >= Math.min(ax, bx) - epsilon
      && lng <= Math.max(ax, bx) + epsilon && lat >= Math.min(ay, by) - epsilon
      && lat <= Math.max(ay, by) + epsilon) return 0;
    if ((ay > lat) !== (by > lat) && lng < (bx - ax) * (lat - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside ? 1 : -1;
}

/** Inclusion réelle, avec les trous et toutes les parties d'un secteur, pas seulement son emprise. */
export function sectorContainsPoint(geometry: SectorGeometry, lng: number, lat: number): boolean {
  return sectorPartAtPoint(geometry, lng, lat) != null;
}

/** La partie cliquée uniquement : les zones disjointes ne sont pas colorées avec elle. */
export function sectorPartAtPoint(geometry: SectorGeometry, lng: number, lat: number): Polygon | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const coordinates = polygons.find(([outer, ...holes]) => outer && inRing(lng, lat, outer) >= 0
    && holes.every(hole => inRing(lng, lat, hole) !== 1));
  return coordinates ? { type: 'Polygon', coordinates } : null;
}

/** Tous les prestataires couvrant le point, y compris lorsque plusieurs secteurs se superposent. */
export function sectorProvidersAtPoint(
  providers: { id: number | null; geometry: SectorGeometry | null }[], lng: number, lat: number,
): number[] {
  return [...new Set(providers.filter(provider => provider.id != null && provider.geometry
    && sectorContainsPoint(provider.geometry, lng, lat)).map(provider => provider.id!))];
}

/** Aire locale : origine décalée pour éviter la soustraction de grands produits voisins. */
function signedRingArea(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const [ox, oy] = ring[0];
  let twiceArea = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    twiceArea += (ring[j][0] - ox) * (ring[i][1] - oy) - (ring[i][0] - ox) * (ring[j][1] - oy);
  }
  return twiceArea / 2;
}

function ringArea(ring: Position[]): number { return Math.abs(signedRingArea(ring)); }

function strictlyInside(point: Position, polygon: Polygon): boolean {
  const [outer, ...holes] = polygon.coordinates;
  return !!outer && inRing(point[0], point[1], outer) === 1
    && holes.every(hole => inRing(point[0], point[1], hole) === -1);
}

type Edge = { a: Position; b: Position; interiorSide: number };
function polygonEdges(polygon: Polygon): Edge[] {
  return polygon.coordinates.flatMap((ring, index) => {
    // L'intérieur du polygone est du côté opposé pour un trou, quel que soit le winding GeoJSON.
    const interiorSide = Math.sign(signedRingArea(ring)) * (index === 0 ? 1 : -1);
    return ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return a[0] === b[0] && a[1] === b[1] ? [] : [{ a, b, interiorSide }];
    });
  });
}

function orientation(a: Position, b: Position, p: Position): number {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  return Math.abs(cross) < 1e-12 ? 0 : Math.sign(cross);
}

/** Intersection de surface : un bord ou un sommet commun ne suffit pas. */
function polygonsOverlap(left: Polygon, right: Polygon): boolean {
  if (!left.coordinates[0]?.length || !right.coordinates[0]?.length) return false;
  const bounds = (polygon: Polygon) => polygon.coordinates[0].reduce(
    (b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  const a = bounds(left), b = bounds(right);
  if (Math.max(a[0], b[0]) >= Math.min(a[2], b[2])
    || Math.max(a[1], b[1]) >= Math.min(a[3], b[3])) return false;
  if (left.coordinates[0].some(point => strictlyInside(point, right))
    || right.coordinates[0].some(point => strictlyInside(point, left))) return true;
  const leftEdges = polygonEdges(left), rightEdges = polygonEdges(right);
  for (const edge of leftEdges) {
    // Attrape aussi une entrée par un sommet situé exactement sur le bord opposé.
    if (strictlyInside([(edge.a[0] + edge.b[0]) / 2, (edge.a[1] + edge.b[1]) / 2], right)) return true;
    for (const other of rightEdges) {
      const abC = orientation(edge.a, edge.b, other.a), abD = orientation(edge.a, edge.b, other.b);
      const cdA = orientation(other.a, other.b, edge.a), cdB = orientation(other.a, other.b, edge.b);
      if (abC * abD < 0 && cdA * cdB < 0) return true;
      if (abC !== 0 || abD !== 0) continue;
      const axis = Math.abs(edge.b[0] - edge.a[0]) > Math.abs(edge.b[1] - edge.a[1]) ? 0 : 1;
      const sharedLength = Math.min(Math.max(edge.a[axis], edge.b[axis]), Math.max(other.a[axis], other.b[axis]))
        - Math.max(Math.min(edge.a[axis], edge.b[axis]), Math.min(other.a[axis], other.b[axis]));
      const sameDirection = Math.sign(edge.b[axis] - edge.a[axis]) === Math.sign(other.b[axis] - other.a[axis]);
      if (sharedLength > 0 && edge.interiorSide === other.interiorSide * (sameDirection ? 1 : -1)) return true;
    }
  }
  return rightEdges.some(edge => strictlyInside(
    [(edge.a[0] + edge.b[0]) / 2, (edge.a[1] + edge.b[1]) / 2], left,
  ));
}

/** Une ville inclut ses arrondissements ; un arrondissement inclut les couvertures de toute la ville. */
export function sectorProvidersInArea(
  providers: { id: number | null; geometry: SectorGeometry | null }[], area: Polygon,
): number[] {
  return [...new Set(providers.filter(provider => {
    if (provider.id == null || !provider.geometry) return false;
    const polygons = provider.geometry.type === 'Polygon' ? [provider.geometry] : provider.geometry.coordinates
      .map(coordinates => ({ type: 'Polygon' as const, coordinates }));
    return polygons.some(polygon => polygonsOverlap(area, polygon));
  }).map(provider => provider.id!))];
}

/** Le plus petit secteur sous le clic prime sur la ville qui l'englobe, quel que soit l'ordre du dessin. */
export function smallestSectorAtPoint(
  providers: { id: number | null; geometry: SectorGeometry | null }[], lng: number, lat: number,
): Polygon | null {
  let selected: Polygon | null = null;
  let smallest = Infinity;
  for (const provider of providers) {
    if (provider.id == null || !provider.geometry) continue;
    const part = sectorPartAtPoint(provider.geometry, lng, lat);
    if (!part) continue;
    const [outer, ...holes] = part.coordinates;
    const area = ringArea(outer) - holes.reduce((sum, hole) => sum + ringArea(hole), 0);
    if (area > 0 && area < smallest) { selected = part; smallest = area; }
  }
  return selected;
}
