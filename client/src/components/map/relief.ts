import type * as maplibregl from 'maplibre-gl';
import { HILLSHADE_LAYER_ID, hillshade, TERRAIN_SOURCE_ID, type BaitlyMapMode } from './baitlyMapStyle';

/** Thème de chaque carte, pour colorer l'ombrage ajouté à la demande. */
const reliefModes = new WeakMap<maplibregl.Map, BaitlyMapMode>();

export function rememberReliefMode(map: maplibregl.Map, mode: BaitlyMapMode): void {
  reliefModes.set(map, mode);
}

/**
 * Relief à la demande : terrain 3D et ombrage n'existent qu'en vue inclinée. À plat, la
 * carte ne télécharge ni ne décode aucune tuile d'altitude (gain au chargement et à chaque
 * déplacement). Sans source d'altitude (archive indisponible), ne fait rien.
 */
export function setRelief(map: maplibregl.Map, on: boolean): void {
  if (!map.getSource(TERRAIN_SOURCE_ID)) return;
  if (!on) {
    map.setTerrain(null);
    if (map.getLayer(HILLSHADE_LAYER_ID)) map.removeLayer(HILLSHADE_LAYER_ID);
    return;
  }
  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.15 });
  if (map.getLayer(HILLSHADE_LAYER_ID)) return;
  // Sous l'eau, comme dans le style complet (images statiques).
  const beforeId = map.getLayer('water') ? 'water' : undefined;
  map.addLayer(hillshade(reliefModes.get(map) ?? 'light'), beforeId);
}
