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

function line(x1: string, y1: string, x2: string, y2: string): SVGLineElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  el.setAttribute('x1', x1);
  el.setAttribute('y1', y1);
  el.setAttribute('x2', x2);
  el.setAttribute('y2', y2);
  return el;
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
