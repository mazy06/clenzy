import type * as maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

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
  /** Secteur mis en avant (survol d'une ligne de légende, fiche ouverte). */
  highlightedProviderId?: number | null;
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

function collection(overlay: SectorOverlay, theme: SectorTheme): FeatureCollection {
  const feature = (geometry: SectorGeometry, color: string, providerId: number | null): Feature => ({
    type: 'Feature',
    geometry,
    properties: { color, highlighted: providerId != null && providerId === overlay.highlightedProviderId },
  });
  if (overlay.mode === 'merged') {
    return { type: 'FeatureCollection', features: overlay.merged ? [feature(overlay.merged, mergedSectorColor(theme), null)] : [] };
  }
  return {
    type: 'FeatureCollection',
    features: overlay.providers.flatMap((provider, index) =>
      provider.geometry ? [feature(provider.geometry, sectorColor(index, theme), provider.id)] : []),
  };
}

export class BaitlySectorLayer {
  private overlay: SectorOverlay | null = null;
  private theme: SectorTheme = 'light';
  // Un changement de thème remplace le style par diff, sans `style.load` : nos calques
  // disparaissent en silence. Chaque `styledata` vérifie qu'ils sont encore là.
  private readonly reapply = () => {
    if (this.overlay && !this.map.getSource(SOURCE_ID)) this.apply();
  };

  constructor(private readonly map: maplibregl.Map) {
    map.on('styledata', this.reapply);
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
    const { map } = this;
    if (!this.overlay) {
      this.removeLayers();
      return;
    }
    const data = collection(this.overlay, this.theme);
    const palette = PALETTES[this.theme];
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data });
    const beforeId = firstSymbolLayer(map);
    map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['get', 'highlighted'], palette.fill * 2, palette.fill],
      },
    }, beforeId);
    // Liseré sous la bordure : la détache des limites administratives du fond de carte.
    map.addLayer({
      id: CASING_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': palette.casing,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3.5, 13, 6],
      },
    }, beforeId);
    map.addLayer({
      id: LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 13, ['case', ['get', 'highlighted'], 3.5, 2.5]],
        'line-opacity': 0.95,
      },
    }, beforeId);
  }

  private removeLayers(): void {
    const { map } = this;
    if (!map.style) return;
    for (const id of [LINE_ID, CASING_ID, FILL_ID]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
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
