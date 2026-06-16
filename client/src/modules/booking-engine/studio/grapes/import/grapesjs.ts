import { type ImportedHtml, type TemplateImporter, newReport, escapeHtml } from './TemplateImporter';

/**
 * Adaptateur GrapesJS — réimport d'un export GrapesJS.
 *
 * Deux formes acceptées :
 *   1. un export simple `{ html, css }` (le plus fidèle) → utilisé tel quel ;
 *   2. un `projectData` GrapesJS (`{ pages, styles, … }`) → on reconstruit le HTML depuis l'arbre de
 *      composants (tagName/attributes/components/content) et le CSS depuis `styles` (selectors+style).
 * Ne jette jamais (JSON illisible / forme inconnue → html vide + warning).
 */
function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);

function detectGrapes(input: string): boolean {
  const s = (input ?? '').trim();
  if (!s.startsWith('{')) return false;
  try {
    const o = asObj(JSON.parse(s));
    if (!o) return false;
    // projectData (clé `pages`) ou export simple (`html` + `css`).
    return 'pages' in o || ('html' in o && 'css' in o);
  } catch {
    return false;
  }
}

/** Reconstruit le HTML d'un nœud de composant GrapesJS (récursif). */
function componentToHtml(raw: unknown): string {
  const node = asObj(raw);
  if (!node) return '';
  // Nœud textuel : `type: 'textnode'` ou contenu sans tag.
  if (str(node.type) === 'textnode') return escapeHtml(str(node.content));
  const tag = str(node.tagName) || 'div';
  const classes = asArr(node.classes)
    .map((c) => (asObj(c) ? str((asObj(c) as Record<string, unknown>).name) : str(c)))
    .filter(Boolean);
  const attrsObj = asObj(node.attributes) ?? {};
  const attrs: string[] = [];
  if (classes.length) attrs.push(`class="${escapeHtml(classes.join(' '))}"`);
  for (const [k, v] of Object.entries(attrsObj)) {
    if (k === 'class') continue;
    attrs.push(`${escapeHtml(k)}="${escapeHtml(str(v))}"`);
  }
  const open = `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  if (VOID_TAGS.has(tag)) return open;
  const inner = node.content
    ? escapeHtml(str(node.content))
    : asArr(node.components).map(componentToHtml).join('');
  return `${open}${inner}</${tag}>`;
}

/** Reconstruit le CSS depuis le tableau `styles` GrapesJS (`{ selectors:[…], style:{…} }`). */
function stylesToCss(styles: unknown[]): string {
  const rules: string[] = [];
  for (const raw of styles) {
    const rule = asObj(raw);
    if (!rule) continue;
    const sel = asArr(rule.selectors)
      .map((s) => (asObj(s) ? `.${str((asObj(s) as Record<string, unknown>).name)}` : `.${str(s)}`))
      .join('');
    const decl = asObj(rule.style);
    if (!sel || !decl) continue;
    const body = Object.entries(decl)
      .map(([k, v]) => `${k}:${str(v)}`)
      .join(';');
    if (body) rules.push(`${sel}{${body}}`);
  }
  return rules.join('\n');
}

function projectToHtmlCss(parsed: Record<string, unknown>): { html: string; css: string } {
  const pages = asArr(parsed.pages);
  const htmlParts: string[] = [];
  for (const p of pages) {
    const page = asObj(p);
    if (!page) continue;
    for (const f of asArr(page.frames)) {
      const frame = asObj(f);
      if (frame && frame.component) htmlParts.push(componentToHtml(frame.component));
    }
  }
  return { html: htmlParts.join('\n'), css: stylesToCss(asArr(parsed.styles)) };
}

const grapesjsImporter: TemplateImporter = {
  id: 'grapesjs',
  label: 'GrapesJS',
  detect: detectGrapes,
  toHtml(input: string): ImportedHtml {
    const report = newReport('grapesjs');
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = asObj(JSON.parse(input ?? ''));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      report.warnings.push('JSON GrapesJS illisible.');
      return { html: '', report };
    }
    // Forme simple { html, css }.
    if ('html' in parsed) {
      return { html: str(parsed.html), css: str(parsed.css), report };
    }
    // projectData.
    const { html, css } = projectToHtmlCss(parsed);
    if (!html.trim()) report.warnings.push('Aucun composant exploitable dans le projet GrapesJS.');
    return { html, css, report };
  },
};

export default grapesjsImporter;
