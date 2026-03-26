import { DOMNode, CSSOverride, STYLE_PROPERTIES } from './types';

// ─── Inspector ID management ────────────────────────────────────────────────

export function ensureInspectorId(el: Element, counterRef: { current: number }): string {
  let id = el.getAttribute('data-iid');
  if (!id) {
    id = String(++counterRef.current);
    el.setAttribute('data-iid', id);
  }
  return id;
}

// ─── CSS path builder ───────────────────────────────────────────────────────

export function buildCSSPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current.tagName !== 'BODY') {
    let selector = current.tagName.toLowerCase();
    if (current.id && !current.id.startsWith('css-')) {
      selector += `#${current.id}`;
    } else {
      const classes = [...current.classList];
      const firstUseful = classes.find((c) => c.length < 40) || classes[0];
      if (firstUseful) selector += `.${firstUseful}`;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

// ─── Computed styles extraction ─────────────────────────────────────────────

export function getComputedStylesFiltered(el: Element): Record<string, string> {
  const computed = window.getComputedStyle(el);
  const result: Record<string, string> = {};
  for (const prop of STYLE_PROPERTIES) {
    const val = computed.getPropertyValue(prop);
    if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px') {
      result[prop] = val;
    }
  }
  return result;
}

// ─── DOM tree builder ───────────────────────────────────────────────────────

export function buildDOMTree(el: Element, depth = 0): DOMNode | null {
  if (depth > 20) return null;
  const tag = el.tagName.toLowerCase();
  if (tag === 'style' || tag === 'script' || tag === 'link') return null;

  const allClasses = [...el.classList];
  const displayClasses = allClasses.map((c) => {
    if (c.startsWith('MuiBox-root') || c.startsWith('MuiTypography-root')) return null;
    if (c.startsWith('css-')) return c;
    return c;
  }).filter(Boolean) as string[];

  const children = [...el.children]
    .map((c) => buildDOMTree(c, depth + 1))
    .filter(Boolean) as DOMNode[];

  return {
    tag,
    classes: displayClasses,
    id: el.id || '',
    path: buildCSSPath(el),
    element: el,
    children,
    depth,
  };
}

// ─── CSS override serialization ─────────────────────────────────────────────

export function overridesToCSS(overrides: CSSOverride[]): string {
  const grouped = new Map<string, Record<string, string>>();
  for (const o of overrides) {
    const existing = grouped.get(o.selector) || {};
    existing[o.property] = o.value;
    grouped.set(o.selector, existing);
  }
  const rules: string[] = [];
  for (const [selector, props] of grouped) {
    const declarations = Object.entries(props)
      .map(([p, v]) => `  ${p}: ${v} !important;`)
      .join('\n');
    rules.push(`${selector} {\n${declarations}\n}`);
  }
  return rules.join('\n\n');
}
