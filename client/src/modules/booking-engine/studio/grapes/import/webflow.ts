import { type ImportedHtml, type TemplateImporter, newReport, escapeHtml } from './TemplateImporter';
import { sanitizeHtml } from './sanitizeHtml';

/**
 * Adaptateur Webflow — JSON du presse-papier Webflow Designer (`@webflow/XscpData`).
 *
 * Structure : `{ type:"@webflow/XscpData", payload:{ nodes:[…], styles:[…] } }`. Chaque nœud porte un
 * `_id`, un `tag` (ou `type`), des `classes` (références de styles) et des `children` (ids). On reconstruit
 * le HTML depuis l'arbre ; les styles Webflow (classes générées) ne sont pas rematérialisés → warning.
 * Le HTML exporté par « Export code » de Webflow, lui, passe par l'adaptateur HTML (fidèle). Ne jette jamais.
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

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input']);

/** Récupère le tableau de nœuds Webflow (sous `payload.nodes` ou `nodes` racine). */
function rootNodes(parsed: unknown): unknown[] | null {
  const obj = asObj(parsed);
  if (!obj) return null;
  const payload = asObj(obj.payload);
  if (payload && Array.isArray(payload.nodes)) return payload.nodes;
  if (Array.isArray(obj.nodes)) return obj.nodes;
  return null;
}

function detectWebflow(input: string): boolean {
  const s = (input ?? '').trim();
  if (!s.startsWith('{')) return false;
  if (s.includes('@webflow/XscpData')) return true;
  try {
    return !!rootNodes(JSON.parse(s));
  } catch {
    return false;
  }
}

const TYPE_TAG: Record<string, string> = {
  Heading: 'h2', Paragraph: 'p', Link: 'a', Image: 'img', List: 'ul', ListItem: 'li', Block: 'div', Section: 'section',
};

const webflowImporter: TemplateImporter = {
  id: 'webflow',
  label: 'Webflow',
  detect: detectWebflow,
  toHtml(input: string): ImportedHtml {
    const report = newReport('webflow');
    let nodes: unknown[] | null = null;
    try {
      nodes = rootNodes(JSON.parse(input ?? ''));
    } catch {
      nodes = null;
    }
    if (!nodes) {
      report.warnings.push('JSON Webflow illisible.');
      return { html: '', report };
    }
    // Carte id → nœud, et repérage des enfants (pour déterminer les racines).
    const byId = new Map<string, Record<string, unknown>>();
    const childIds = new Set<string>();
    for (const raw of nodes) {
      const n = asObj(raw);
      if (!n) continue;
      byId.set(str(n._id), n);
      for (const c of asArr(n.children)) childIds.add(str(c));
    }
    const toHtmlNode = (id: string, depth: number): string => {
      if (depth > 50) return '';
      const n = byId.get(id);
      if (!n) return '';
      // Nœud texte : `text: true` + valeur dans `v` ou `text`.
      if (n.text === true || typeof n.v === 'string') return escapeHtml(str(n.v) || str(n.text));
      const tag = str(n.tag) || TYPE_TAG[str(n.type)] || 'div';
      const attrsObj = asObj(n.data) ? (asObj((asObj(n.data) as Record<string, unknown>).attr) ?? {}) : {};
      const attrs: string[] = [];
      for (const [k, v] of Object.entries(attrsObj)) attrs.push(`${escapeHtml(k)}="${escapeHtml(str(v))}"`);
      const open = `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
      if (VOID_TAGS.has(tag)) return open;
      const inner = asArr(n.children).map((c) => toHtmlNode(str(c), depth + 1)).join('');
      return `${open}${inner}</${tag}>`;
    };
    const roots = [...byId.keys()].filter((id) => !childIds.has(id));
    const html = sanitizeHtml(roots.map((id) => toHtmlNode(id, 0)).join('\n'));
    if (!html.trim()) report.warnings.push('Aucun nœud Webflow exploitable.');
    report.warnings.push(
      'Conversion structurelle Webflow (les classes/styles générés ne sont pas rematérialisés) — fidélité limitée. Pour un rendu fidèle, utilisez « Export code » de Webflow (onglet Coller/Fichier) ou l’import URL.',
    );
    return { html, report };
  },
};

export default webflowImporter;
