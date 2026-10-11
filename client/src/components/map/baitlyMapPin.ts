/**
 * Épingle Baitly — élément DOM réel (pas un symbole WebGL) : les custom
 * properties `--bui-*` s'y résolvent, l'épingle suit donc le thème clair /
 * sombre sans table de couleurs dupliquée, et elle reçoit le focus clavier.
 *
 * <p>Forme : un badge rond couleur carte, cerclé de la teinte, qui porte
 * l'icône métier (logement, remise de clés) et se termine par une pointe sur
 * le point exact. Sélectionné, le badge se remplit de la teinte.</p>
 *
 * <p>La position est pilotée par MapLibre via `transform` sur l'élément racine :
 * toute animation se fait sur l'enfant `.baitly-map-pin__glyph`.</p>
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** `slot` : badge vide, l'appelant y monte sa propre icône (portail React, cf. GuideMap). */
export type BaitlyPinIcon = 'home' | 'key' | 'wrench' | 'clipboard' | 'dot' | 'slot';

/** Tracés Lucide (ISC) — même famille que le reste de l'interface. */
type BuiltInIcon = Exclude<BaitlyPinIcon, 'dot' | 'slot'>;

const ICON_PATHS: Record<BuiltInIcon, string[]> = {
  home: [
    'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
    'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  ],
  key: [
    'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
    'M16.5 7.5h.01',
  ],
  wrench: [
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  ],
  clipboard: [
    'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    'M12 11h4',
    'M12 16h4',
    'M8 11h.01',
    'M8 16h.01',
  ],
};

function iconSvg(icon: BuiltInIcon): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'baitly-map-pin__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  ICON_PATHS[icon].forEach((d) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
}

function pinGlyph(icon: BaitlyPinIcon): HTMLSpanElement {
  const glyph = document.createElement('span');
  glyph.className = 'baitly-map-pin__glyph';
  const badge = document.createElement('span');
  badge.className = 'baitly-map-pin__badge';
  if (icon === 'dot') {
    const dot = document.createElement('span');
    dot.className = 'baitly-map-pin__dot';
    badge.append(dot);
  } else if (icon !== 'slot') {
    badge.append(iconSvg(icon));
  }
  const tail = document.createElement('span');
  tail.className = 'baitly-map-pin__tail';
  glyph.append(badge, tail);
  return glyph;
}

export interface BaitlyPinOptions {
  /** Couleur CSS — de préférence un token (`var(--bui-navy)`), sinon une couleur calculée. */
  color: string;
  /** Icône métier portée par le badge ; `dot` pour une simple catégorie. */
  icon?: BaitlyPinIcon;
  /** Nom accessible ; omis pour une épingle purement décorative. */
  label?: string;
  /** Rend l'épingle activable au clavier (Entrée / Espace → clic). */
  interactive?: boolean;
}

export function createBaitlyPin({ color, icon = 'dot', label, interactive = false }: BaitlyPinOptions): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'baitly-map-pin';
  element.style.setProperty('--pin-color', color);
  element.append(pinGlyph(icon));
  if (label) element.setAttribute('aria-label', label);
  if (!interactive) return element;

  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      element.click();
    }
  });
  return element;
}

/** Emplacement de l'icône d'une épingle créée avec `icon: 'slot'`. */
export function pinIconSlot(pin: HTMLElement): HTMLElement {
  return pin.querySelector<HTMLElement>('.baitly-map-pin__badge') ?? pin;
}

/** Contenu de bulle — `textContent`, le nom venant de la saisie utilisateur. */
export function pinPopupContent(text: string): HTMLElement {
  const title = document.createElement('strong');
  title.className = 'baitly-map-popup__title';
  title.textContent = text;
  return title;
}

/**
 * Décalage d'une bulle ouverte sur une épingle ancrée en bas (badge 36 px +
 * pointe 8 px) : au-dessus de la tête quand la bulle monte, sous la pointe
 * quand elle bascule près du bord.
 */
export const PIN_POPUP_OFFSET = {
  top: [0, 6],
  'top-left': [0, 6],
  'top-right': [0, 6],
  bottom: [0, -50],
  'bottom-left': [0, -50],
  'bottom-right': [0, -50],
  left: [22, -26],
  right: [-22, -26],
  center: [0, -26],
} satisfies Record<string, [number, number]>;
