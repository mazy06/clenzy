/**
 * Icônes du widget de réservation — glyphes Reicon (https://reicon.dev), graisse
 * duotone privilégiée comme dans le PMS (contour pour les glyphes sans duotone,
 * plein pour les états actifs : étoile notée, favori).
 *
 * Contenu 100 % statique, aucune entrée utilisateur ; DOM construit nœud par nœud
 * (`createElementNS`, jamais `innerHTML`) pour rester compatible avec les CSP /
 * Trusted Types des sites hôtes. Géométrie : `reiconGlyphs.ts` (généré par
 * `scripts/reicon/generate-sdk-icons.mjs`).
 */
import { REICON_GLYPHS, type GlyphNode, type ReiconGlyphName } from './reiconGlyphs';

const SVG_NS = 'http://www.w3.org/2000/svg';

function build([tag, attrs, children]: GlyphNode): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  children?.forEach((child) => el.appendChild(build(child)));
  return el;
}

function glyph(name: ReiconGlyphName): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', '16');
  el.setAttribute('height', '16');
  el.setAttribute('aria-hidden', 'true');
  // Aplats en `currentColor` ; `stroke="none"` neutralise d'éventuelles règles CSS
  // héritées (`svg { stroke: currentColor }`) qui épaissiraient le glyphe.
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', 'currentColor');
  g.setAttribute('stroke', 'none');
  REICON_GLYPHS[name].forEach((node) => g.appendChild(build(node as GlyphNode)));
  el.appendChild(g);
  return el;
}

/** Icône « filtres » (curseurs) — déclencheur du widget Filtre. */
export const sliders = (): SVGSVGElement => glyph('tuning2-duotone');
export const chevronDown = (): SVGSVGElement => glyph('chevron-down');
export const chevronLeft = (): SVGSVGElement => glyph('chevron-left');
export const chevronRight = (): SVGSVGElement => glyph('chevron-right');
export const arrowLeft = (): SVGSVGElement => glyph('arrow-left-duotone');
export const minus = (): SVGSVGElement => glyph('minus');
export const plus = (): SVGSVGElement => glyph('plus');
export const check = (): SVGSVGElement => glyph('check');
export const calendar = (): SVGSVGElement => glyph('calendar-duotone');
export const users = (): SVGSVGElement => glyph('users-duotone');

/** Cœur favori (2.11). `filled` → plein (favori actif), sinon contour. */
export const heart = (filled = false): SVGSVGElement => glyph(filled ? 'heart-filled' : 'heart');

/** Étoile (note/avis). `filled` → pleine (par défaut, pour une note), sinon contour. */
export const star = (filled = true): SVGSVGElement => glyph(filled ? 'star-filled' : 'star');

/** Lit (nombre de chambres). */
export const bedDouble = (): SVGSVGElement => glyph('bed-duotone');
/** Épingle de localisation (ville du logement). */
export const mapPin = (): SVGSVGElement => glyph('map-point-duotone');

// ─── Icônes d'équipement ───

export const wifi = (): SVGSVGElement => glyph('wifi');
export const tv = (): SVGSVGElement => glyph('tv-duotone');
export const wind = (): SVGSVGElement => glyph('wind-duotone');
export const flame = (): SVGSVGElement => glyph('flame-duotone');
export const pot = (): SVGSVGElement => glyph('chef-hat-duotone');
export const appliance = (): SVGSVGElement => glyph('fridge-duotone');
export const washer = (): SVGSVGElement => glyph('washer-duotone');
export const parking = (): SVGSVGElement => glyph('parking');
export const waves = (): SVGSVGElement => glyph('water-duotone');
export const bath = (): SVGSVGElement => glyph('bath-duotone');
export const tree = (): SVGSVGElement => glyph('tree');
export const lock = (): SVGSVGElement => glyph('lock-duotone');
/** Lit bébé / chaise haute. */
export const crib = (): SVGSVGElement => glyph('chair-duotone');
/** Icône générique (équipement custom hors catalogue) : étincelles. */
export const amenityDefault = (): SVGSVGElement => glyph('stars-duotone');

/** Code équipement (catalogue built-in) → fabrique d'icône. */
const AMENITY_ICONS: Record<string, () => SVGSVGElement> = {
  WIFI: wifi, TV: tv, AIR_CONDITIONING: wind, HEATING: flame,
  EQUIPPED_KITCHEN: pot, DISHWASHER: appliance, MICROWAVE: appliance, OVEN: appliance,
  WASHING_MACHINE: washer, DRYER: washer, IRON: appliance, HAIR_DRYER: wind,
  PARKING: parking, POOL: waves, JACUZZI: bath, GARDEN_TERRACE: tree,
  BARBECUE: flame, SAFE: lock, BABY_BED: crib, HIGH_CHAIR: crib,
};

/** Icône d'un code équipement ; repli sur une icône générique pour les codes custom. */
export function amenityIcon(code: string): SVGSVGElement {
  return (AMENITY_ICONS[code] ?? amenityDefault)();
}
