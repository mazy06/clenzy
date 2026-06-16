import { type ImportedHtml, type TemplateImporter, newReport, escapeHtml } from './TemplateImporter';
import { sanitizeHtml } from './sanitizeHtml';

/**
 * Adaptateur Elementor — JSON de template (`{ content: [ { elType, widgetType, settings, elements } ] }`
 * ou tableau d'éléments). L'export Elementor ne contient PAS le CSS final (généré au runtime depuis les
 * `settings` par le moteur Elementor) → structure HTML best-effort. FIDÉLITÉ LIMITÉE : préférer l'import
 * URL de la page publiée. Ne jette jamais.
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

/** Récupère le tableau d'éléments racine d'une entrée Elementor (objet `{content}` ou tableau brut). */
function rootElements(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  const obj = asObj(parsed);
  if (obj && Array.isArray(obj.content)) return obj.content;
  return null;
}

function detectElementor(input: string): boolean {
  const s = (input ?? '').trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return false;
  try {
    const els = rootElements(JSON.parse(s));
    return !!els && els.some((e) => asObj(e) && 'elType' in (asObj(e) as object));
  } catch {
    return false;
  }
}

/** Rendu d'un widget Elementor selon son `widgetType` (sous-ensemble courant ; reste → texte générique). */
function widgetToHtml(el: Record<string, unknown>): string {
  const wt = str(el.widgetType);
  const s = asObj(el.settings) ?? {};
  switch (wt) {
    case 'heading':
      return s.title ? `<h2>${escapeHtml(str(s.title))}</h2>` : '';
    case 'text-editor':
      // Déjà du HTML rédigé par l'utilisateur (assaini en aval par loadIntoEditor).
      return str(s.editor);
    case 'image': {
      const img = asObj(s.image);
      const url = img ? str(img.url) : str(s.image);
      return url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(str(s.alt))}" />` : '';
    }
    case 'button': {
      const link = asObj(s.link);
      const url = link ? str(link.url) : str(s.url) || '#';
      const text = str(s.text) || str(s.button_text) || 'En savoir plus';
      return `<a class="btn" href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
    }
    default: {
      const text = str(s.title) || str(s.text) || str(s.editor) || str(s.description);
      if (!text) return '';
      // Si le contenu contient déjà du markup, on le laisse (assaini en aval) ; sinon on échappe.
      return `<div>${/[<>]/.test(text) ? text : escapeHtml(text)}</div>`;
    }
  }
}

function elementToHtml(raw: unknown): string {
  const el = asObj(raw);
  if (!el) return '';
  const children = asArr(el.elements).map(elementToHtml).join('');
  switch (str(el.elType)) {
    case 'section':
    case 'container':
      return `<section>${children}</section>`;
    case 'column':
      return `<div class="col">${children}</div>`;
    case 'widget':
      return widgetToHtml(el);
    default:
      return children;
  }
}

const elementorImporter: TemplateImporter = {
  id: 'elementor',
  label: 'Elementor',
  detect: detectElementor,
  toHtml(input: string): ImportedHtml {
    const report = newReport('elementor');
    const src = input ?? '';
    let els: unknown[] | null = null;
    try {
      els = rootElements(JSON.parse(src));
    } catch {
      els = null;
    }
    if (!els) {
      report.warnings.push('JSON Elementor illisible.');
      return { html: '', report };
    }
    const html = sanitizeHtml(els.map(elementToHtml).join(''));
    report.warnings.push(
      'Conversion structurelle Elementor (l’export ne contient pas le CSS du moteur) — fidélité limitée. Pour un rendu fidèle, importez l’URL de la page publiée.',
    );
    return { html, report };
  },
};

export default elementorImporter;
