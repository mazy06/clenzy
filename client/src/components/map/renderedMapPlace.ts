import type { Map, PointLike } from 'maplibre-gl';

/** Uniquement les symboles effectivement visibles, en tenant compte des filtres et du zoom. */
export function renderedMapPlaceAt(map: Map, point: PointLike) {
  const layers = ['pois', 'world-pois'].filter(id => map.getLayer(id));
  return layers.length ? map.queryRenderedFeatures(point, { layers }).find(feature => feature.geometry.type === 'Point' && typeof feature.properties?.name === 'string') : undefined;
}
