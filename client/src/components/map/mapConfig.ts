import { runtimeEnv } from '../../config/runtimeConfig';

/**
 * Où la carte Baitly lit ses tuiles et ses ressources de style.
 *
 * <p>Par défaut tout est servi en MÊME ORIGINE sous `/maps/` : nginx relaie vers
 * le conteneur OVH public des cartes (prod), Vite sert `public/maps/` et relaie
 * `/maps/assets` (dev). Aucun jeton, aucune CSP à élargir. Les clés runtime ne
 * servent qu'à pointer une autre source sans reconstruire l'image.</p>
 *
 * <p>MapLibre résout ces URL dans un worker : elles doivent être ABSOLUES.</p>
 */
const absolute = (url: string): string => new URL(url, window.location.origin).href;

/** Archive PMTiles (schéma Protomaps v4) — cf. `scripts/maps/build-baitly-tiles.sh`. */
export function mapTilesUrl(): string {
  return absolute(runtimeEnv('VITE_MAP_TILES_URL') ?? '/maps/baitly.pmtiles');
}

/** Racine des glyphes (`fonts/`) et des sprites (`sprites/v4/`). */
export function mapAssetsUrl(): string {
  return absolute(runtimeEnv('VITE_MAP_ASSETS_URL') ?? '/maps/assets').replace(/\/$/, '');
}

/** Archive d'altitude (raster-dem Terrarium) — relief et terrain 3D. */
export function mapTerrainUrl(): string {
  return absolute(runtimeEnv('VITE_MAP_TERRAIN_URL') ?? '/maps/terrain.pmtiles');
}
