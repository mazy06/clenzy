import * as maplibregl from 'maplibre-gl';
import i18n from '../../i18n/config';
import { activeLanguage } from '../../utils/activeLocale';
import { buildBaitlyMapStyle, dayPeriodAt, daylightFor, TERRAIN_SOURCE_ID, type BaitlyMapMode, type DayPeriod } from './baitlyMapStyle';
import { ensureMapRuntime } from './mapRuntime';
import { prefersReducedMotion } from './motion';
import { BaitlyPerspectiveControl, PERSPECTIVE_CAMERA } from './perspectiveControl';

export { prefersReducedMotion };

export interface BaitlyMapOptions {
  container: HTMLElement;
  mode: BaitlyMapMode;
  /** [lng, lat] */
  center: [number, number];
  zoom: number;
  /** `false` : vignette figée — ni geste, ni contrôle de navigation. */
  interactive?: boolean;
  /** Boussole + rotation. Inutile pour placer un point : on la retire. */
  compass?: boolean;
  /**
   * `false` uniquement si l'appelant affiche lui-même la mention « © OpenStreetMap »
   * (vignette dans un lien, où les liens du contrôle seraient imbriqués).
   */
  attribution?: boolean;
  /**
   * Vue 3D : caméra inclinée sur les bâtiments en volume + bouton 2D/3D.
   * Réservée aux cartes de consultation ; placer un point se fait à plat.
   */
  perspective?: boolean;
}

/**
 * Carte Baitly prête à l'emploi : style maison dans la langue de l'interface,
 * attribution OSM compacte (obligation ODbL — ne pas la retirer), contrôles
 * habillés par `baitly-map.css`.
 */
export function createBaitlyMap({
  container,
  mode,
  center,
  zoom,
  interactive = true,
  compass = true,
  attribution = true,
  perspective = false,
}: BaitlyMapOptions): maplibregl.Map {
  ensureMapRuntime();
  const period = currentPeriod(center[0]);
  const map = new maplibregl.Map({
    container,
    style: buildBaitlyMapStyle(mode, activeLanguage(), period),
    center,
    zoom,
    interactive,
    attributionControl: false,
    dragRotate: compass || perspective,
    touchPitch: perspective,
    maxPitch: 65,
    ...(perspective ? PERSPECTIVE_CAMERA : {}),
    fadeDuration: prefersReducedMotion() ? 0 : 300,
    locale: controlsLocale(),
  });
  if (attribution) {
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    // Mentions repliées derrière le bouton ⓘ dès l'ouverture (MapLibre les déplie
    // d'abord) : accessibles d'un clic, comme l'admet l'ODbL, sans encombrer la carte.
    map.once('load', () => {
      container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    });
  }
  if (interactive) {
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: compass || perspective, visualizePitch: perspective }),
      'top-right',
    );
    if (perspective) map.addControl(new BaitlyPerspectiveControl(), 'top-right');
  }
  if (perspective) {
    // Terrain 3D sur les cartes inclinées : le relief prend du volume. Réappliqué à
    // chaque style chargé (le changement de thème remplace le style, pas la carte).
    map.on('style.load', () => {
      if (map.getSource(TERRAIN_SOURCE_ID)) map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.15 });
    });
  }
  followDaylight(map, mode, period);
  return map;
}

/** Aperçu de dev : `?period=dawn|day|dusk|night` fige le moment de la journée. */
function forcedPeriod(): DayPeriod | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('period');
  return value === 'dawn' || value === 'day' || value === 'dusk' || value === 'night' ? value : null;
}

function currentPeriod(longitude: number): DayPeriod {
  return forcedPeriod() ?? dayPeriodAt(new Date(), longitude);
}

/**
 * La lumière suit le lieu et l'heure : après un déplacement lointain (autre
 * fuseau) ou au fil de la journée, seuls la lumière et le ciel changent — pas
 * de rechargement du style, donc ni clignotement ni épingles reposées.
 */
/** Mode courant de chaque carte (le thème peut changer après création). */
const mapModes = new WeakMap<maplibregl.Map, BaitlyMapMode>();

function followDaylight(map: maplibregl.Map, mode: BaitlyMapMode, initial: DayPeriod): void {
  mapModes.set(map, mode);
  let period = initial;
  const update = () => {
    const next = currentPeriod(map.getCenter().lng);
    if (next === period || !map.isStyleLoaded()) return;
    period = next;
    const { light, sky } = daylightFor(mapModes.get(map) ?? mode, next);
    map.setLight(light);
    map.setSky(sky);
  };
  map.on('moveend', update);
  const timer = window.setInterval(update, 10 * 60_000);
  map.once('remove', () => window.clearInterval(timer));
}

/** Bascule clair / sombre sans recréer la carte (les marqueurs DOM restent en place). */
export function setBaitlyMapMode(map: maplibregl.Map, mode: BaitlyMapMode): void {
  mapModes.set(map, mode);
  map.setStyle(buildBaitlyMapStyle(mode, activeLanguage(), currentPeriod(map.getCenter().lng)));
}

/** Libellés accessibles des contrôles MapLibre (anglais par défaut) dans la langue de l'interface. */
function controlsLocale(): Record<string, string> {
  return {
    'Popup.Close': i18n.t('baitlyMap.controls.close', 'Fermer'),
    'NavigationControl.ZoomIn': i18n.t('baitlyMap.controls.zoomIn', 'Zoom avant'),
    'NavigationControl.ZoomOut': i18n.t('baitlyMap.controls.zoomOut', 'Zoom arrière'),
    'NavigationControl.ResetBearing': i18n.t('baitlyMap.controls.resetBearing', 'Réorienter vers le nord'),
    'AttributionControl.ToggleAttribution': i18n.t('baitlyMap.controls.attribution', 'Afficher les crédits'),
  };
}
