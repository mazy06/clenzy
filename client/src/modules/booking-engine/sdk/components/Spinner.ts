/** Lightweight SVG spinner — no user input, static SVG content only */
export function createSpinner(size: 'sm' | 'md' | 'lg' = 'md'): HTMLElement {
  const el = document.createElement('span');
  el.className = `cb-spinner${size !== 'md' ? ` cb-spinner--${size}` : ''}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Loading');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');

  const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  bgPath.setAttribute('d', 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83');
  bgPath.setAttribute('opacity', '0.25');

  const fgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  fgPath.setAttribute('d', 'M12 2v4');

  svg.appendChild(bgPath);
  svg.appendChild(fgPath);
  el.appendChild(svg);

  return el;
}
