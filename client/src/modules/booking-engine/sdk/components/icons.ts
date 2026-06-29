/** SVG icon factory — all static content, no user input */

function svg(viewBox: string, ...children: SVGElement[]): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '2');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('width', '16');
  el.setAttribute('height', '16');
  children.forEach(c => el.appendChild(c));
  return el;
}

function path(d: string): SVGPathElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', d);
  return el;
}

function polyline(points: string): SVGPolylineElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  el.setAttribute('points', points);
  return el;
}

function polygon(points: string): SVGPolygonElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  el.setAttribute('points', points);
  return el;
}

function line(x1: string, y1: string, x2: string, y2: string): SVGLineElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  el.setAttribute('x1', x1);
  el.setAttribute('y1', y1);
  el.setAttribute('x2', x2);
  el.setAttribute('y2', y2);
  return el;
}

function circle(cx: string, cy: string, r: string): SVGCircleElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('cx', cx);
  el.setAttribute('cy', cy);
  el.setAttribute('r', r);
  return el;
}

function rect(x: string, y: string, w: string, h: string, rx = '0'): SVGRectElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  if (rx !== '0') { el.setAttribute('rx', rx); el.setAttribute('ry', rx); }
  return el;
}

/** Icône « filtres » (curseurs/sliders) — déclencheur du widget Filtre. */
export function sliders(): SVGSVGElement {
  return svg(
    '0 0 24 24',
    line('4', '6', '20', '6'), line('4', '12', '20', '12'), line('4', '18', '20', '18'),
    circle('9', '6', '2'), circle('15', '12', '2'), circle('7', '18', '2'),
  );
}

export function chevronDown(): SVGSVGElement {
  return svg('0 0 24 24', polyline('6 9 12 15 18 9'));
}

export function chevronLeft(): SVGSVGElement {
  return svg('0 0 24 24', polyline('15 18 9 12 15 6'));
}

export function chevronRight(): SVGSVGElement {
  return svg('0 0 24 24', polyline('9 18 15 12 9 6'));
}

export function arrowLeft(): SVGSVGElement {
  return svg('0 0 24 24', line('19', '12', '5', '12'), polyline('12 19 5 12 12 5'));
}

export function minus(): SVGSVGElement {
  return svg('0 0 24 24', line('5', '12', '19', '12'));
}

export function plus(): SVGSVGElement {
  return svg('0 0 24 24', line('12', '5', '12', '19'), line('5', '12', '19', '12'));
}

export function check(): SVGSVGElement {
  const el = svg('0 0 24 24', polyline('20 6 9 17 4 12'));
  el.setAttribute('stroke-width', '3');
  return el;
}

export function alertCircle(): SVGSVGElement {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  return svg('0 0 24 24', circle, line('12', '8', '12', '12'), line('12', '16', '12.01', '16'));
}

export function calendar(): SVGSVGElement {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '3');
  rect.setAttribute('y', '4');
  rect.setAttribute('width', '18');
  rect.setAttribute('height', '18');
  rect.setAttribute('rx', '2');
  rect.setAttribute('ry', '2');
  return svg('0 0 24 24',
    rect,
    line('16', '2', '16', '6'),
    line('8', '2', '8', '6'),
    line('3', '10', '21', '10'),
  );
}

export function users(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'),
    path('M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
    path('M23 21v-2a4 4 0 0 0-3-3.87'),
    path('M16 3.13a4 4 0 0 1 0 7.75'),
  );
}

/** Cœur favori (2.11). `filled` → rempli (favori actif), sinon contour seul. */
export function heart(filled = false): SVGSVGElement {
  const el = svg('0 0 24 24',
    path('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'),
  );
  if (filled) el.setAttribute('fill', 'currentColor');
  return el;
}

/** Étoile (note/avis). `filled` → pleine (par défaut, pour une note). */
export function star(filled = true): SVGSVGElement {
  const el = svg('0 0 24 24', polygon('12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26'));
  if (filled) el.setAttribute('fill', 'currentColor');
  return el;
}
/** Flèche droite (CTA). */
export function arrowRight(): SVGSVGElement {
  return svg('0 0 24 24', line('5', '12', '19', '12'), polyline('12 5 19 12 12 19'));
}
/** Bouclier coché (confiance / réservation directe). */
export function shieldCheck(): SVGSVGElement {
  return svg('0 0 24 24', path('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'), polyline('9 12 11 14 15 10'));
}
/** Lit double (nombre de chambres). */
export function bedDouble(): SVGSVGElement {
  return svg('0 0 24 24', path('M2 11v8'), path('M22 11v8'), path('M2 11h20'), path('M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4'), path('M6 11V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2'), path('M13 11V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2'));
}
/** Dièse (référence de réservation). */
export function hash(): SVGSVGElement {
  return svg('0 0 24 24', line('4', '9', '20', '9'), line('4', '15', '20', '15'), line('10', '3', '8', '21'), line('16', '3', '14', '21'));
}
/** Téléchargement (reçu). */
export function download(): SVGSVGElement {
  return svg('0 0 24 24', path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), polyline('7 10 12 15 17 10'), line('12', '15', '12', '3'));
}

/** Épingle de localisation (ville du logement). */
export function mapPin(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z'),
    circle('12', '10', '3'),
  );
}

// ─── Icônes d'équipement (mêmes conventions : trait `currentColor`, viewBox 24) ───

export function wifi(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M2.5 8.5a13 13 0 0 1 19 0'),
    path('M5.5 11.8a9 9 0 0 1 13 0'),
    path('M8.5 15.1a5 5 0 0 1 7 0'),
    circle('12', '19', '1'),
  );
}
export function tv(): SVGSVGElement {
  return svg('0 0 24 24', rect('2', '5', '20', '13', '2'), line('7', '21', '17', '21'), line('12', '18', '12', '21'));
}
export function wind(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M3 8h11a2.5 2.5 0 1 0-2.5-2.5'),
    path('M3 12h16a2.5 2.5 0 1 1-2.5 2.5'),
    path('M3 16h9a2.5 2.5 0 1 1-2.5 2.5'),
  );
}
export function flame(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'),
  );
}
export function pot(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M3 10h18v4a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z'),
    line('8', '6', '16', '6'),
    line('12', '3', '12', '6'),
  );
}
export function appliance(): SVGSVGElement {
  return svg('0 0 24 24',
    rect('4', '3', '16', '18', '2'),
    line('4', '8', '20', '8'),
    line('8', '5.5', '13', '5.5'),
    line('8', '13', '16', '13'),
  );
}
export function washer(): SVGSVGElement {
  return svg('0 0 24 24',
    rect('4', '2', '16', '20', '2'),
    line('4', '7', '20', '7'),
    circle('8', '4.5', '0.6'),
    circle('11', '4.5', '0.6'),
    circle('12', '14', '5'),
    circle('12', '14', '1.6'),
  );
}
export function parking(): SVGSVGElement {
  return svg('0 0 24 24',
    rect('3', '3', '18', '18', '3'),
    path('M9 17V7h4a3 3 0 0 1 0 6H9'),
  );
}
export function waves(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M2 7c.6.5 1.2 1 2.5 1C7 8 7 6 9.5 6c2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1'),
    path('M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1'),
    path('M2 17c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1'),
  );
}
export function bath(): SVGSVGElement {
  return svg('0 0 24 24',
    path('M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z'),
    path('M5 12V6a2 2 0 0 1 4 0'),
    line('5', '19', '5', '21'),
    line('19', '19', '19', '21'),
  );
}
export function tree(): SVGSVGElement {
  return svg('0 0 24 24', circle('12', '9', '6'), line('12', '15', '12', '21'));
}
export function lock(): SVGSVGElement {
  return svg('0 0 24 24',
    rect('3', '11', '18', '11', '2'),
    path('M7 11V7a5 5 0 0 1 10 0v4'),
    circle('12', '16', '1'),
  );
}
export function crib(): SVGSVGElement {
  return svg('0 0 24 24',
    line('3', '7', '3', '20'), line('21', '7', '21', '20'),
    line('3', '20', '21', '20'), line('3', '7', '21', '7'),
    line('3', '13', '21', '13'),
    line('8', '13', '8', '20'), line('13', '13', '13', '20'), line('18', '13', '18', '20'),
  );
}
/** Icône générique (équipement custom hors catalogue) : petite étoile. */
export function amenityDefault(): SVGSVGElement {
  return svg('0 0 24 24', path('M12 3l1.9 4.6L19 9.5l-4.6 1.9L12 16l-1.9-4.6L5 9.5l4.6-1.9z'));
}

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
