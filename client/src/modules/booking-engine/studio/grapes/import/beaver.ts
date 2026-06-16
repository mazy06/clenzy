import { type ImportedHtml, type TemplateImporter, newReport, escapeHtml } from './TemplateImporter';
import { sanitizeHtml } from './sanitizeHtml';

/**
 * Adaptateur Beaver Builder.
 *
 * Beaver expose deux formes courantes : (1) du MARKUP HTML avec classes `fl-*` (mise en page rendue) →
 * on le conserve tel quel (assaini) ; (2) un JSON de NŒUDS (`type: 'row' | 'column' | 'module'` + `settings`)
 * → structure HTML best-effort en extrayant heading/text/photo/bouton des `settings`. FIDÉLITÉ LIMITÉE pour
 * la forme JSON (pas de CSS du moteur) : préférer l'import URL de la page publiée. Ne jette jamais.
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

/** Tableau de nœuds Beaver (racine tableau, ou sous une clé `nodes`/`data`). */
function rootNodes(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  const obj = asObj(parsed);
  if (!obj) return null;
  if (Array.isArray(obj.nodes)) return obj.nodes;
  if (Array.isArray(obj.data)) return obj.data;
  return null;
}

function isBeaverNodes(nodes: unknown[]): boolean {
  return nodes.some((n) => {
    const o = asObj(n);
    return !!o && 'type' in o && ['row', 'column', 'module'].includes(str(o.type));
  });
}

function detectBeaver(input: string): boolean {
  const s = (input ?? '').trim();
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const nodes = rootNodes(JSON.parse(s));
      return !!nodes && isBeaverNodes(nodes);
    } catch {
      return false;
    }
  }
  // Markup Beaver rendu.
  return /class="[^"]*\bfl-(row|col|module|builder)/.test(s);
}

/** Extrait un fragment HTML des `settings` d'un module Beaver (heading / text / photo / bouton). */
function moduleToHtml(settings: Record<string, unknown>): string {
  const parts: string[] = [];
  const heading = str(settings.heading) || str(settings.title);
  if (heading) parts.push(`<h3>${escapeHtml(heading)}</h3>`);
  const text = str(settings.text) || str(settings.editor) || str(settings.content);
  if (text) parts.push(/[<>]/.test(text) ? text : `<p>${escapeHtml(text)}</p>`);
  const photo = asObj(settings.photo);
  const photoUrl = photo ? str(photo.url) : str(settings.photo_url) || str(settings.src);
  if (photoUrl) parts.push(`<img src="${escapeHtml(photoUrl)}" alt="" />`);
  const btnText = str(settings.btn_text) || str(settings.link_text);
  if (btnText) {
    const url = str(settings.link) || str(settings.btn_link) || '#';
    parts.push(`<a class="btn" href="${escapeHtml(url)}">${escapeHtml(btnText)}</a>`);
  }
  return parts.join('');
}

function nodesToHtml(nodes: unknown[]): string {
  return nodes
    .map((raw) => {
      const n = asObj(raw);
      if (!n) return '';
      const settings = asObj(n.settings) ?? {};
      switch (str(n.type)) {
        case 'row':
          return `<section>${moduleToHtml(settings)}</section>`;
        case 'column':
          return `<div class="col">${moduleToHtml(settings)}</div>`;
        case 'module':
          return moduleToHtml(settings);
        default:
          return '';
      }
    })
    .join('');
}

const beaverImporter: TemplateImporter = {
  id: 'beaver',
  label: 'Beaver Builder',
  detect: detectBeaver,
  toHtml(input: string): ImportedHtml {
    const report = newReport('beaver');
    const src = input ?? '';
    if (!src.trim()) {
      report.warnings.push('Entrée Beaver Builder vide.');
      return { html: '', report };
    }
    const trimmed = src.trim();
    // Forme markup : on conserve le HTML rendu (assaini).
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      report.notes = 'Markup Beaver conservé tel quel (assaini).';
      return { html: sanitizeHtml(src), report };
    }
    // Forme JSON de nœuds.
    let nodes: unknown[] | null = null;
    try {
      nodes = rootNodes(JSON.parse(trimmed));
    } catch {
      nodes = null;
    }
    if (!nodes) {
      report.warnings.push('JSON Beaver Builder illisible.');
      return { html: '', report };
    }
    const html = sanitizeHtml(nodesToHtml(nodes));
    if (!html.trim()) report.warnings.push('Aucun module Beaver exploitable.');
    report.warnings.push(
      'Conversion structurelle Beaver (sans le CSS du moteur) — fidélité limitée. Pour un rendu fidèle, importez l’URL de la page publiée.',
    );
    return { html, report };
  },
};

export default beaverImporter;
