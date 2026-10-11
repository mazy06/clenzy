import { layers, type Flavor } from '@protomaps/basemaps';
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { mapAssetsUrl, mapTerrainUrl, mapTilesUrl } from './mapConfig';

/**
 * Style cartographique Baitly — deux palettes dessinées pour le PMS, posées sur
 * les calques open source Protomaps (données OpenStreetMap).
 *
 * <p>Intention : une carte qui se LIT d'un coup d'œil. Chaque grande famille a
 * sa teinte franche — l'eau bleue, la végétation verte, les plages sable, les
 * autoroutes cerclées d'ambre (accès au logement) — et la hiérarchie routière se
 * lit au liseré : routes blanches cerclées sur un fond papier chaud. Les bâtiments sont
 * dessinés (remplissage + contour) pour situer un logement à l'îlot près. Les
 * libellés reprennent le bleu nuit du wordmark avec un halo plein.</p>
 *
 * <p>Les couleurs sont écrites en clair : MapLibre les peint dans un canvas
 * WebGL, où un `var(--bui-…)` ne se résout pas.</p>
 */

export type BaitlyMapMode = 'light' | 'dark';
export type BaitlyMapLanguage = 'fr' | 'en' | 'ar';

const SOURCE_ID = 'protomaps';

/**
 * Papier — clair et contrasté : fond papier chaud, eau bleue, verts francs.
 * Toutes les routes sont BLANCHES (choix produit) : la hiérarchie se lit à la
 * largeur et au liseré — gris chaud pour la voirie, ambre pour les autoroutes.
 */
export const BAITLY_PAPER: Flavor = {
  background: '#E6E1D6',
  earth: '#F3F0E8',
  park_a: '#C8E3BC',
  park_b: '#A8D49A',
  hospital: '#F6D9D7',
  industrial: '#E4DFE8',
  school: '#F0E5C8',
  wood_a: '#BEDDB0',
  wood_b: '#9BCB8C',
  pedestrian: '#EEE9DE',
  scrub_a: '#D3E6C2',
  scrub_b: '#BCDBA8',
  glacier: '#FAFCFD',
  sand: '#F0E2BE',
  beach: '#F6E1A6',
  aerodrome: '#DCE1EA',
  runway: '#C3CAD6',
  water: '#7FBCE3',
  zoo: '#CDE5C4',
  military: '#E3DED5',
  tunnel_other_casing: '#D8D1C4',
  tunnel_minor_casing: '#D8D1C4',
  tunnel_link_casing: '#D3C9B8',
  tunnel_major_casing: '#CFC4B1',
  tunnel_highway_casing: '#E8C58C',
  tunnel_other: '#FFFFFF',
  tunnel_minor: '#FFFFFF',
  tunnel_link: '#FFFFFF',
  tunnel_major: '#FFFFFF',
  tunnel_highway: '#FFFFFF',
  pier: '#E9E4DA',
  buildings: '#DFD8CB',
  minor_service_casing: '#D9D2C5',
  minor_casing: '#CFC7B8',
  link_casing: '#C4B9A6',
  major_casing_late: '#BBAF9A',
  highway_casing_late: '#D99A3D',
  other: '#FFFFFF',
  minor_service: '#FFFFFF',
  minor_a: '#FFFFFF',
  minor_b: '#FFFFFF',
  link: '#FFFFFF',
  major_casing_early: '#BBAF9A',
  major: '#FFFFFF',
  highway_casing_early: '#D99A3D',
  highway: '#FFFFFF',
  railway: '#8C96A3',
  boundaries: '#8A7FA0',
  bridges_other_casing: '#D9D2C5',
  bridges_minor_casing: '#CFC7B8',
  bridges_link_casing: '#C4B9A6',
  bridges_major_casing: '#B3A68F',
  bridges_highway_casing: '#C98A2E',
  bridges_other: '#FFFFFF',
  bridges_minor: '#FFFFFF',
  bridges_link: '#FFFFFF',
  bridges_major: '#FFFFFF',
  bridges_highway: '#FFFFFF',
  roads_label_minor: '#59636E',
  roads_label_minor_halo: '#FFFFFF',
  roads_label_major: '#3A4652',
  roads_label_major_halo: '#FFFFFF',
  ocean_label: '#1F5F8B',
  subplace_label: '#4B5866',
  subplace_label_halo: '#F7F5F0',
  city_label: '#1B2A35',
  city_label_halo: '#FFFFFF',
  state_label: '#7A6F8F',
  state_label_halo: '#F7F5F0',
  country_label: '#3A4652',
  address_label: '#6D7782',
  address_label_halo: '#FFFFFF',
  pois: {
    blue: '#1F6FB2',
    green: '#23824B',
    lapis: '#3B50C4',
    pink: '#C2408A',
    red: '#D0443F',
    slategray: '#56606D',
    tangerine: '#C2620F',
    turquoise: '#0E8C82',
  },
  landcover: {
    grassland: 'rgba(205, 229, 188, 1)',
    barren: 'rgba(240, 230, 206, 1)',
    urban_area: 'rgba(236, 232, 223, 1)',
    farmland: 'rgba(230, 235, 200, 1)',
    glacier: 'rgba(250, 252, 253, 1)',
    scrub: 'rgba(214, 230, 192, 1)',
    forest: 'rgba(176, 214, 164, 1)',
  },
};

/** Nuit — sombre et contrasté : terre bleu nuit, eau bleu profond, verts sapin, axes ambre. */
export const BAITLY_NIGHT: Flavor = {
  background: '#0A1120',
  earth: '#152036',
  park_a: '#17392C',
  park_b: '#1B4433',
  hospital: '#2E2233',
  industrial: '#1C2540',
  school: '#2A2A33',
  wood_a: '#183B2C',
  wood_b: '#1C4834',
  pedestrian: '#1B2741',
  scrub_a: '#1A3530',
  scrub_b: '#1E3F35',
  glacier: '#26344F',
  sand: '#2B2B32',
  beach: '#3A3426',
  aerodrome: '#1D2842',
  runway: '#2C3A57',
  water: '#16497A',
  zoo: '#183A2D',
  military: '#1E2638',
  tunnel_other_casing: '#0D1628',
  tunnel_minor_casing: '#0D1628',
  tunnel_link_casing: '#0D1628',
  tunnel_major_casing: '#0D1628',
  tunnel_highway_casing: '#0D1628',
  tunnel_other: '#202D47',
  tunnel_minor: '#202D47',
  tunnel_link: '#26354F',
  tunnel_major: '#2A3A57',
  tunnel_highway: '#6E5530',
  pier: '#22304A',
  buildings: '#2B3B5A',
  minor_service_casing: '#0E1729',
  minor_casing: '#0E1729',
  link_casing: '#0E1729',
  major_casing_late: '#0B1324',
  highway_casing_late: '#0B1324',
  other: '#223049',
  minor_service: '#26344F',
  minor_a: '#293853',
  minor_b: '#2E3E5B',
  link: '#34466A',
  major_casing_early: '#0B1324',
  major: '#3A4E74',
  highway_casing_early: '#0B1324',
  highway: '#C08A3E',
  railway: '#4A5A78',
  boundaries: '#7C8CB0',
  bridges_other_casing: '#0E1729',
  bridges_minor_casing: '#0E1729',
  bridges_link_casing: '#0E1729',
  bridges_major_casing: '#0B1324',
  bridges_highway_casing: '#0B1324',
  bridges_other: '#223049',
  bridges_minor: '#2E3E5B',
  bridges_link: '#34466A',
  bridges_major: '#3A4E74',
  bridges_highway: '#C08A3E',
  roads_label_minor: '#A3B3CA',
  roads_label_minor_halo: '#152036',
  roads_label_major: '#C9D5E6',
  roads_label_major_halo: '#152036',
  ocean_label: '#79AEE0',
  subplace_label: '#AFC0D6',
  subplace_label_halo: '#0F192C',
  city_label: '#F1F5FB',
  city_label_halo: '#0A1120',
  state_label: '#8A9AC0',
  state_label_halo: '#0F192C',
  country_label: '#C9D5E6',
  address_label: '#8698B2',
  address_label_halo: '#152036',
  pois: {
    blue: '#6FB2EC',
    green: '#4FCB8A',
    lapis: '#8FA0FF',
    pink: '#F07BC0',
    red: '#F38B86',
    slategray: '#A9B6C9',
    tangerine: '#F0A75E',
    turquoise: '#34D9C3',
  },
  landcover: {
    grassland: 'rgba(24, 52, 41, 1)',
    barren: 'rgba(36, 38, 50, 1)',
    urban_area: 'rgba(25, 36, 58, 1)',
    farmland: 'rgba(28, 46, 42, 1)',
    glacier: 'rgba(38, 52, 79, 1)',
    scrub: 'rgba(26, 53, 48, 1)',
    forest: 'rgba(22, 58, 43, 1)',
  },
};

/**
 * Police des libellés : « Baitly Sans » — Plus Jakarta Sans (latin) + Tajawal
 * (arabe), complétée par Noto Sans pour les autres écritures (tifinagh…). Glyphes
 * générés par scripts/maps/fonts/build-baitly-fonts.sh.
 */
const BAITLY_FONTS = { regular: 'Baitly Sans Regular', bold: 'Baitly Sans Medium', italic: 'Baitly Sans Italic' };

const FLAVORS: Record<BaitlyMapMode, Flavor> = {
  light: { ...BAITLY_PAPER, ...BAITLY_FONTS },
  dark: { ...BAITLY_NIGHT, ...BAITLY_FONTS },
};

/** Contour des bâtiments, une marche au-dessus du remplissage. */
const BUILDING_OUTLINE: Record<BaitlyMapMode, string> = { light: '#C7BEAE', dark: '#33456A' };

/**
 * Commerces masqués : une carte de gestion locative n'est pas un guide de
 * sorties, et ces dizaines de pictogrammes noyaient les épingles des logements.
 * Restent les repères qui orientent : monuments, parcs, transports, santé, plages.
 */
const HIDDEN_POI_KINDS = [
  'restaurant', 'fast_food', 'cafe', 'bar', 'supermarket', 'convenience',
  'books', 'beauty', 'electronics', 'clothes', 'bench', 'toilets', 'drinking_water',
];

/**
 * Retouches au-delà de la palette : les bâtiments apparaissent en fondu
 * (z13 → z14) au lieu de surgir d'un bloc, avec un contour fin qui dessine les
 * îlots ; au-delà, la version 3D (`buildings-3d`) prend le relais.
 */
function refine(layer: LayerSpecification, mode: BaitlyMapMode): LayerSpecification {
  if (layer.id === 'pois' && layer.type === 'symbol' && layer.filter) {
    return {
      ...layer,
      filter: ['all', layer.filter as ExpressionSpecification, ['!', ['in', ['get', 'kind'], ['literal', HIDDEN_POI_KINDS]]]],
    };
  }
  if (layer.id === 'buildings' && layer.type === 'fill') {
    return {
      ...layer,
      maxzoom: 15,
      paint: {
        ...layer.paint,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
        'fill-outline-color': BUILDING_OUTLINE[mode],
      },
    };
  }
  return layer;
}

/** Hauteur retenue quand OSM n'en donne pas : ~4 niveaux, la médiane des centres urbains visés. */
const DEFAULT_BUILDING_HEIGHT = 12;

/**
 * Bâtiments en volume : ils « poussent » entre z14 et z15 (pas d'apparition
 * brutale), avec un dégradé vertical qui assombrit le pied des façades. Placés
 * après les routes et avant les libellés, comme l'exige le rendu 3D.
 */
function buildings3d(mode: BaitlyMapMode): LayerSpecification {
  const grow = (value: ExpressionSpecification): ExpressionSpecification =>
    ['interpolate', ['linear'], ['zoom'], 14, 0, 15, value];
  return {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: SOURCE_ID,
    'source-layer': 'buildings',
    minzoom: 14,
    filter: ['in', 'kind', 'building', 'building_part'],
    paint: {
      'fill-extrusion-color': FLAVORS[mode].buildings,
      'fill-extrusion-height': grow(['coalesce', ['get', 'height'], DEFAULT_BUILDING_HEIGHT]),
      'fill-extrusion-base': grow(['coalesce', ['get', 'min_height'], 0]),
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  };
}

/** Lumière rasante chaude (après-midi) en Papier, clair de lune froid en Nuit. */
const LIGHT: Record<BaitlyMapMode, NonNullable<StyleSpecification['light']>> = {
  light: { anchor: 'viewport', color: '#FFF6EA', intensity: 0.16, position: [1.2, 210, 30] },
  dark: { anchor: 'viewport', color: '#C9D6F2', intensity: 0.3, position: [1.2, 210, 30] },
};

/** Ciel visible caméra inclinée : se fond dans le fond de carte à l'horizon. */
const SKY: Record<BaitlyMapMode, NonNullable<StyleSpecification['sky']>> = {
  light: {
    'sky-color': '#BFDDF2',
    'horizon-color': '#F4EFE6',
    'fog-color': '#F1EDE5',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.75,
  },
  dark: {
    'sky-color': '#060B16',
    'horizon-color': '#1B2A45',
    'fog-color': '#0F182B',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.75,
  },
};

/**
 * Moment de la journée au LIEU affiché : heure solaire (UTC + longitude / 15),
 * pas l'heure de l'écran — un logement à Riyad a déjà sa lumière du soir quand
 * il est 16 h à Paris.
 */
export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night';

export function dayPeriodAt(date: Date, longitude: number): DayPeriod {
  const solarHour = (((date.getUTCHours() + date.getUTCMinutes() / 60 + longitude / 15) % 24) + 24) % 24;
  if (solarHour >= 5 && solarHour < 8) return 'dawn';
  if (solarHour >= 8 && solarHour < 17.5) return 'day';
  if (solarHour >= 17.5 && solarHour < 20.5) return 'dusk';
  return 'night';
}

type Light = NonNullable<StyleSpecification['light']>;
type Sky = NonNullable<StyleSpecification['sky']>;

/**
 * Lumière et ciel par moment de la journée. Le soleil se lève à l'est (azimut 90)
 * et se couche à l'ouest (270), rasant à l'aube et au crépuscule — les façades
 * s'éclairent du bon côté. La palette (Papier / Nuit) reste celle du thème.
 */
const DAYLIGHT: Record<BaitlyMapMode, Record<DayPeriod, { light: Light; sky: Sky }>> = {
  light: {
    dawn: {
      light: { anchor: 'viewport', color: '#FFEFE2', intensity: 0.18, position: [1.3, 100, 70] },
      sky: { ...SKY.light, 'sky-color': '#F2C8B4', 'horizon-color': '#FBE6D2', 'fog-color': '#F6EBDF' },
    },
    day: { light: LIGHT.light, sky: SKY.light },
    dusk: {
      light: { anchor: 'viewport', color: '#FFE6D2', intensity: 0.2, position: [1.3, 260, 72] },
      sky: { ...SKY.light, 'sky-color': '#E3A487', 'horizon-color': '#F5D2B4', 'fog-color': '#F3E4D6' },
    },
    night: {
      light: { anchor: 'viewport', color: '#E3E9F8', intensity: 0.18, position: [1.2, 210, 40] },
      sky: { ...SKY.light, 'sky-color': '#5A6F9C', 'horizon-color': '#C9D2E4', 'fog-color': '#E4E6EC' },
    },
  },
  dark: {
    dawn: {
      light: { anchor: 'viewport', color: '#E8C9B8', intensity: 0.32, position: [1.3, 100, 70] },
      sky: { ...SKY.dark, 'sky-color': '#2A2340', 'horizon-color': '#6B4A55' },
    },
    day: {
      light: { anchor: 'viewport', color: '#E4E9F2', intensity: 0.26, position: [1.2, 210, 30] },
      sky: { ...SKY.dark, 'sky-color': '#16264A', 'horizon-color': '#2C4470' },
    },
    dusk: {
      light: { anchor: 'viewport', color: '#E9B48E', intensity: 0.34, position: [1.3, 260, 72] },
      sky: { ...SKY.dark, 'sky-color': '#2B1F3A', 'horizon-color': '#7A4B4B' },
    },
    night: { light: LIGHT.dark, sky: SKY.dark },
  },
};

/** Lumière et ciel d'un moment de la journée (mise à jour sans recharger le style). */
export function daylightFor(mode: BaitlyMapMode, period: DayPeriod): { light: Light; sky: Sky } {
  return DAYLIGHT[mode][period];
}

/** Rivage : un liseré plus soutenu que l'eau dessine les côtes, berges et lacs. */
const SHORELINE: Record<BaitlyMapMode, string> = { light: '#4E9CCF', dark: '#2F6FAE' };

function shoreline(mode: BaitlyMapMode): LayerSpecification {
  return {
    id: 'water_shoreline',
    type: 'line',
    source: SOURCE_ID,
    'source-layer': 'water',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'line-color': SHORELINE[mode],
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.3, 12, 0.8, 16, 1.6],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.35, 12, 0.7],
    },
  };
}

function withShoreline(base: LayerSpecification[], mode: BaitlyMapMode): LayerSpecification[] {
  const water = base.findIndex((layer) => layer.id === 'water');
  if (water === -1) return base;
  return [...base.slice(0, water + 1), shoreline(mode), ...base.slice(water + 1)];
}

/**
 * Ombrage du relief : discret en plaine, il dessine l'Atlas, les Alpes ou le
 * Hedjaz. Lumière venant du nord-ouest (convention cartographique). Placé sous
 * l'eau et les routes : il module le fond sans salir le réseau.
 */
const HILLSHADE: Record<BaitlyMapMode, { shadow: string; highlight: string; accent: string; exaggeration: number }> = {
  light: { shadow: '#6E6253', highlight: '#FFFDF8', accent: '#9C8E7C', exaggeration: 0.32 },
  dark: { shadow: '#03060C', highlight: '#2E4064', accent: '#0B1424', exaggeration: 0.42 },
};

function hillshade(mode: BaitlyMapMode): LayerSpecification {
  const colors = HILLSHADE[mode];
  return {
    id: 'terrain_hillshade',
    type: 'hillshade',
    source: TERRAIN_SOURCE_ID,
    paint: {
      'hillshade-shadow-color': colors.shadow,
      'hillshade-highlight-color': colors.highlight,
      'hillshade-accent-color': colors.accent,
      'hillshade-exaggeration': colors.exaggeration,
      'hillshade-illumination-direction': 315,
    },
  };
}

function withHillshade(base: LayerSpecification[], mode: BaitlyMapMode): LayerSpecification[] {
  const water = base.findIndex((layer) => layer.id === 'water');
  const at = water === -1 ? 1 : water;
  return [...base.slice(0, at), hillshade(mode), ...base.slice(at)];
}

/** Les volumes passent sous les libellés : on les insère avant le premier calque de texte. */
function withBuildings3d(base: LayerSpecification[], mode: BaitlyMapMode): LayerSpecification[] {
  const firstSymbol = base.findIndex((layer) => layer.type === 'symbol');
  const at = firstSymbol === -1 ? base.length : firstSymbol;
  return [...base.slice(0, at), buildings3d(mode), ...base.slice(at)];
}

/** Où le style trouve ses données : navigateur (même origine) ou moteur de rendu serveur. */
export interface BaitlyMapEndpoints {
  /** URL de source vectorielle, ex. `pmtiles://https://…/baitly.pmtiles` ou `pmtiles://{baitly}`. */
  tiles: string;
  /** Modèle d'URL des glyphes, avec `{fontstack}` et `{range}`. */
  glyphs: string;
  /** Racine du sprite (sans extension). */
  sprite: string;
  /**
   * Altitude (raster-dem Terrarium, Mapterhorn) pour l'ombrage du relief et le
   * terrain 3D, ex. `pmtiles://https://…/terrain.pmtiles`. Absent : carte sans relief.
   */
  terrain?: string;
}

/** Identifiant de la source d'altitude (réutilisé par `map.setTerrain`). */
export const TERRAIN_SOURCE_ID = 'baitly-terrain';

/**
 * Style Baitly indépendant de l'environnement : utilisé par la carte web
 * (`buildBaitlyMapStyle`) ET par le générateur du style du moteur de rendu des
 * images (e-mails, tuiles raster du mobile) — une seule palette, deux supports.
 *
 * <p>`flat` : rendu à plat (images statiques) — ni bâtiments en volume, ni ciel,
 * les bâtiments restent dessinés à tous les zooms.</p>
 */
export function composeBaitlyMapStyle(
  mode: BaitlyMapMode,
  language: BaitlyMapLanguage,
  endpoints: BaitlyMapEndpoints,
  { flat = false, period = 'day' }: { flat?: boolean; period?: DayPeriod } = {},
): StyleSpecification {
  const base = withShoreline(
    layers(SOURCE_ID, FLAVORS[mode], { lang: language }).map((layer) => refine(layer, mode)),
    mode,
  );
  const daylight = DAYLIGHT[mode][period];
  const withRelief = (layerList: LayerSpecification[]) =>
    endpoints.terrain ? withHillshade(layerList, mode) : layerList;
  const flatLayers = base.map((layer) => {
    if (layer.id !== 'buildings') return layer;
    const { maxzoom: _maxzoom, ...rest } = layer;
    return rest as LayerSpecification;
  });
  return {
    version: 8,
    name: mode === 'dark' ? 'Baitly Nuit' : 'Baitly Papier',
    glyphs: endpoints.glyphs,
    sprite: endpoints.sprite,
    light: daylight.light,
    ...(flat ? {} : { sky: daylight.sky }),
    sources: {
      [SOURCE_ID]: {
        type: 'vector',
        url: endpoints.tiles,
        // « © OpenStreetMap » est une OBLIGATION de la licence ODbL des données : ne
        // jamais la retirer. Protomaps (schéma de tuiles, BSD) n'exige rien : les
        // tuiles sont fabriquées et servies par Baitly, d'où « BaitlyMap ».
        attribution:
          'BaitlyMap · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
      },
      ...(endpoints.terrain
        ? {
            [TERRAIN_SOURCE_ID]: {
              type: 'raster-dem' as const,
              url: endpoints.terrain,
              encoding: 'terrarium' as const,
              tileSize: 512,
              // Relief : Mapterhorn, d'après IGN (Licence Ouverte 2.0) et Copernicus GLO-30.
              attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">© Mapterhorn</a>',
            },
          }
        : {}),
    },
    layers: withRelief(flat ? flatLayers : withBuildings3d(base, mode)),
  };
}

export function buildBaitlyMapStyle(
  mode: BaitlyMapMode,
  language: BaitlyMapLanguage,
  period: DayPeriod = 'day',
): StyleSpecification {
  const assets = mapAssetsUrl();
  return composeBaitlyMapStyle(
    mode,
    language,
    {
      tiles: `pmtiles://${mapTilesUrl()}`,
      glyphs: `${assets}/fonts/{fontstack}/{range}.pbf`,
      sprite: `${assets}/sprites/baitly/${mode}`,
      terrain: `pmtiles://${mapTerrainUrl()}`,
    },
    { period },
  );
}
