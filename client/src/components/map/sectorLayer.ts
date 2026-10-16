import type * as maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { sectorProvidersInArea, smallestSectorAtPoint } from './sectorHitTest';

/**
 * Secteurs d'intervention des prestataires : une bordure et un fond translucide.
 *
 * <p>Deux lectures : « fusionnés » (tous les secteurs réunis sous une seule bordure, pour
 * voir d'un coup d'œil la zone couverte) ou « par prestataire » (un secteur coloré chacun,
 * qui peuvent se chevaucher). Les unions sont calculées côté serveur.</p>
 *
 * <p>Couche posée sous les libellés et les bâtiments : les noms de rues restent lisibles.
 * Un changement de thème remplace le style, et avec lui sources et calques : on les
 * repose dès qu'ils manquent ({@code styledata}).</p>
 */
export type SectorGeometry = Polygon | MultiPolygon;
export type SectorMode = 'merged' | 'byProvider';
export type SectorTheme = 'light' | 'dark';

export interface SectorOverlay {
  providers: { id: number | null; geometry: SectorGeometry | null }[];
  merged: SectorGeometry | null;
  mode: SectorMode;
  /** Secteur survolé : remplace temporairement la sélection ou la vue d'ensemble. */
  highlightedProviderId?: number | null;
  /** Sélection persistante : seul ce secteur est dessiné, sans les contours des autres. */
  selectedProviderId?: number | null;
  /** Fond persistant de la partie du secteur sélectionnée sur la carte. */
  selectedAreaGeometry?: SectorGeometry | null;
  /** Clic sur la carte : prestataires couvrant la zone sélectionnée, ou null hors secteur. */
  onAreaSelect?: (providerIds: number[] | null, geometry?: SectorGeometry | null, point?: { lng: number; lat: number } | null) => void;
}

const SOURCE_ID = 'baitly-sectors';
const FILL_ID = 'baitly-sectors-fill';
const CASING_ID = 'baitly-sectors-casing';
const LINE_ID = 'baitly-sectors-line';

// Le calque ne lit pas les tokens CSS : teintes d'accent Baitly en dur, une gamme par thème.
// La nuit, des teintes claires — une teinte soutenue disparaît sur le fond marine.
const PALETTES: Record<SectorTheme, { merged: string; providers: string[]; casing: string; fill: number }> = {
  light: {
    merged: '#5453D6',
    providers: ['#2F8577', '#B86E2E', '#B24F4F', '#3F76AD', '#7A63B8', '#55707F', '#9A7A12', '#4A8A5A'],
    casing: 'rgba(255, 255, 255, 0.9)',
    fill: 0.14,
  },
  dark: {
    merged: '#A9A8FF',
    providers: ['#6FD3C2', '#F0B27A', '#F29B9B', '#8FB8E8', '#B7A6F0', '#B4C6D2', '#E6C65C', '#8FD19E'],
    casing: 'rgba(8, 12, 28, 0.85)',
    fill: 0.22,
  },
};

/** Couleur de la vue fusionnée : l'indigo Baitly. */
export function mergedSectorColor(theme: SectorTheme): string {
  return PALETTES[theme].merged;
}

export function sectorColor(index: number, theme: SectorTheme): string {
  const { providers } = PALETTES[theme];
  return providers[index % providers.length];
}

/**
 * Les secteurs de plusieurs prestataires se superposent souvent exactement (tout un
 * département) : des fonds empilés noircissaient la carte. Par prestataire, on ne trace
 * donc que les contours. Un survol ou une sélection affiche uniquement le secteur
 * concerné, avec son fond ; quitter le survol restaure la sélection ou l'ensemble.
 *
 * <p>Deux sources : la BASE (tous les secteurs, sans mise en avant) et le secteur MIS EN
 * AVANT. Survoler une ligne de la légende ne renvoie au moteur que ce seul secteur ;
 * masquer les autres change seulement l'opacité des calques. Renvoyer toutes les
 * géométries à chaque survol les faisait re-tuiler, d'où des saccades.</p>
 */
function feature(geometry: SectorGeometry, color: string, fillOpacity: number, lineOpacity: number, highlighted: boolean): Feature {
  return { type: 'Feature', geometry, properties: { color, fillOpacity, lineOpacity, highlighted } };
}

/** Un secteur seul (fiche d'un prestataire) ne chevauche rien : il garde son fond. */
function isAlone(overlay: SectorOverlay): boolean {
  return overlay.providers.filter((provider) => provider.geometry).length === 1;
}

/** Tous les secteurs, sans mise en avant. */
function baseCollection(overlay: SectorOverlay, theme: SectorTheme): FeatureCollection {
  const { fill } = PALETTES[theme];
  if (overlay.mode === 'merged') {
    return { type: 'FeatureCollection', features: overlay.merged ? [feature(overlay.merged, mergedSectorColor(theme), fill, 0.95, false)] : [] };
  }
  const alone = isAlone(overlay);
  const features = overlay.providers
    .map((provider, index) => provider.geometry ? feature(provider.geometry, sectorColor(index, theme), alone ? fill : 0, 0.95, false) : null)
    .filter((f): f is Feature => f != null);
  return { type: 'FeatureCollection', features };
}

/** Le secteur mis en avant, rempli et dessiné au-dessus ; vide sans mise en avant. */
function focusCollection(overlay: SectorOverlay, theme: SectorTheme): FeatureCollection {
  const focused = overlay.highlightedProviderId ?? overlay.selectedProviderId ?? null;
  const index = focused == null ? -1 : overlay.providers.findIndex((provider) => provider.id === focused);
  const geometry = index < 0 ? null : overlay.providers[index].geometry;
  const area = overlay.selectedAreaGeometry;
  const features: Feature[] = area
    ? [feature(area, mergedSectorColor(theme), PALETTES[theme].fill * 2, 0.95, true)] : [];
  if (geometry && (!area || geometry.type !== area.type || geometry.coordinates !== area.coordinates)) {
    features.push(feature(geometry, sectorColor(index, theme), PALETTES[theme].fill * 2, 0.95, true));
  }
  return {
    type: 'FeatureCollection',
    features,
  };
}

const FOCUS_SOURCE_ID = 'baitly-sectors-focus';
const FOCUS_FILL_ID = 'baitly-sectors-focus-fill';
const FOCUS_CASING_ID = 'baitly-sectors-focus-casing';
const FOCUS_LINE_ID = 'baitly-sectors-focus-line';

export class BaitlySectorLayer {
  private overlay: SectorOverlay | null = null;
  private theme: SectorTheme = 'light';
  /** Ce qui façonne la base : tant qu'il ne change pas, la base n'est pas renvoyée. */
  private baseKey: unknown[] | null = null;
  private readonly selectArea = (event: maplibregl.MapMouseEvent) => {
    if (!this.overlay?.onAreaSelect) return;
    const target = event.originalEvent?.target;
    // Les logements, grappes, fiches et commandes gardent leur propre action.
    if (target instanceof Element && target.closest('.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl')) return;
    const lng = ((event.lngLat.lng + 180) % 360 + 360) % 360 - 180;
    const area = smallestSectorAtPoint(this.overlay.providers, lng, event.lngLat.lat);
    const selected = this.overlay.selectedAreaGeometry;
    // Comparer les zones, pas le point du clic : deux endroits du même secteur le désélectionnent.
    if (area && selected?.type === area.type && (selected.coordinates === area.coordinates
      || JSON.stringify(selected.coordinates) === JSON.stringify(area.coordinates))) {
      this.overlay.onAreaSelect(null, null, null);
      return;
    }
    const ids = area ? sectorProvidersInArea(this.overlay.providers, area) : [];
    this.overlay.onAreaSelect(ids.length ? ids : null, area, area ? { lng, lat: event.lngLat.lat } : null);
  };
  // Un changement de thème remplace le style par diff, sans `style.load` : nos calques
  // disparaissent en silence. Chaque `styledata` vérifie qu'ils sont encore là.
  private readonly reapply = () => {
    if (this.overlay && !this.map.getSource(SOURCE_ID)) this.apply();
  };

  constructor(private readonly map: maplibregl.Map) {
    map.on('styledata', this.reapply);
    map.on('click', this.selectArea);
  }

  set(overlay: SectorOverlay | null, theme: SectorTheme): void {
    const themeChanged = theme !== this.theme;
    this.overlay = overlay;
    this.theme = theme;
    // La teinte du liseré et l'opacité du fond sont des propriétés de calque, pas des données.
    if (themeChanged) this.removeLayers();
    this.apply();
  }

  destroy(): void {
    this.map.off('styledata', this.reapply);
    this.map.off('click', this.selectArea);
    this.removeLayers();
  }

  /**
   * `isStyleLoaded()` reste faux tant qu'une source charge ses tuiles (le relief prend des
   * secondes) ; poser un calque n'exige que le style. MapLibre refuse seulement un style
   * pas encore lu — l'écoute de `styledata` reposera alors le calque.
   */
  private apply(): void {
    try {
      this.draw();
    } catch (error) {
      if (!(error instanceof Error) || !/not done loading/i.test(error.message)) throw error;
    }
  }

  private draw(): void {
    const { map, overlay, theme } = this;
    if (!overlay) {
      this.removeLayers();
      return;
    }
    const key = [overlay.providers, overlay.merged, overlay.mode, overlay.mode === 'byProvider' && isAlone(overlay), theme];
    const base = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!base) {
      this.addLayers(baseCollection(overlay, theme), focusCollection(overlay, theme));
      this.baseKey = key;
    } else {
      if (!this.baseKey || key.some((part, index) => part !== this.baseKey![index])) {
        base.setData(baseCollection(overlay, theme));
        this.baseKey = key;
      }
      (map.getSource(FOCUS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(focusCollection(overlay, theme));
    }
    // Survol et sélection isolent le secteur : aucun autre contour ne doit suggérer
    // une couverture plus large. La base reste chargée pour un retour immédiat.
    const focused = overlay.selectedProviderId != null || overlay.highlightedProviderId != null;
    const line: maplibregl.DataDrivenPropertyValueSpecification<number> = focused ? 0 : ['get', 'lineOpacity'];
    map.setPaintProperty(LINE_ID, 'line-opacity', line);
    map.setPaintProperty(CASING_ID, 'line-opacity', line);
    map.setPaintProperty(FILL_ID, 'fill-opacity', focused ? 0 : ['get', 'fillOpacity']);
  }

  private addLayers(base: FeatureCollection, focus: FeatureCollection): void {
    const { map } = this;
    const palette = PALETTES[this.theme];
    map.addSource(SOURCE_ID, { type: 'geojson', data: base });
    map.addSource(FOCUS_SOURCE_ID, { type: 'geojson', data: focus });
    const beforeId = firstSymbolLayer(map);
    for (const [source, fillId, casingId, lineId] of [
      [SOURCE_ID, FILL_ID, CASING_ID, LINE_ID],
      [FOCUS_SOURCE_ID, FOCUS_FILL_ID, FOCUS_CASING_ID, FOCUS_LINE_ID],
    ] as const) {
      map.addLayer({
        id: fillId,
        type: 'fill',
        source,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'fillOpacity'] },
      }, beforeId);
      // Liseré sous la bordure : la détache des limites administratives du fond de carte.
      map.addLayer({
        id: casingId,
        type: 'line',
        source,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': palette.casing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3.5, 13, 6],
          'line-opacity': ['get', 'lineOpacity'],
        },
      }, beforeId);
      map.addLayer({
        id: lineId,
        type: 'line',
        source,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 13, ['case', ['get', 'highlighted'], 3.5, 2.5]],
          'line-opacity': ['get', 'lineOpacity'],
        },
      }, beforeId);
    }
  }

  private removeLayers(): void {
    const { map } = this;
    this.baseKey = null;
    if (!map.style) return;
    for (const id of [FOCUS_LINE_ID, FOCUS_CASING_ID, FOCUS_FILL_ID, LINE_ID, CASING_ID, FILL_ID]) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of [FOCUS_SOURCE_ID, SOURCE_ID]) if (map.getSource(id)) map.removeSource(id);
  }
}

/** Premier calque de texte du style : les secteurs passent dessous. */
function firstSymbolLayer(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
}

/** Emprise [ouest, sud, est, nord] d'un secteur, pour y cadrer la carte. */
export function sectorBounds(geometry: SectorGeometry): [number, number, number, number] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let west = 180, south = 90, east = -180, north = -90;
  for (const polygon of polygons) {
    for (const [lng, lat] of polygon[0]) {
      west = Math.min(west, lng); east = Math.max(east, lng);
      south = Math.min(south, lat); north = Math.max(north, lat);
    }
  }
  return [west, south, east, north];
}
