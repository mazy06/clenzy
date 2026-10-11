import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import rtlTextPluginUrl from '@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './baitly-map.css';

let installed = false;

/**
 * Branche, une fois par page, ce que MapLibre ne fait pas seul :
 * - l'URL de son worker : en v6 (ESM), un bundler ne peut pas la déduire seul ;
 * - le protocole `pmtiles://` (lecture de l'archive par requêtes Range) ;
 * - le plugin RTL, sans lequel l'arabe s'afficherait lettres détachées et
 *   à l'envers. Chargé paresseusement : seulement au premier libellé RTL.
 *   Le fichier est embarqué dans le bundle (même origine, pas de CDN).
 */
export function ensureMapRuntime(): void {
  if (installed) return;
  installed = true;
  maplibregl.setWorkerUrl(workerUrl);
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
    maplibregl.setRTLTextPlugin(rtlTextPluginUrl, true).catch((error: unknown) => {
      // La carte reste utilisable : seuls les libellés arabes seraient mal formés.
      console.warn('[BaitlyMap] plugin RTL indisponible', error);
    });
  }
}
