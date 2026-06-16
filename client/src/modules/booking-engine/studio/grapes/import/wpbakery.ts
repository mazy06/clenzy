import { type ImportedHtml, type TemplateImporter, newReport, escapeHtml } from './TemplateImporter';
import { sanitizeHtml } from './sanitizeHtml';

/**
 * Adaptateur WPBakery / Visual Composer — shortcodes `[vc_row]…`.
 *
 * Comme Divi, les shortcodes ne portent pas le CSS final → structure HTML best-effort
 * (rows/colonnes/textes/images/boutons). FIDÉLITÉ LIMITÉE : préférer l'import URL de la page publiée.
 * Ne jette jamais.
 */
function detectWpBakery(input: string): boolean {
  return /\[vc_row\b/.test(input ?? '') || /\[vc_column\b/.test(input ?? '');
}

function attr(raw: string, name: string): string {
  const m = raw.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : '';
}

function wpbakeryToHtml(input: string): string {
  let h = input;
  // Images : [vc_single_image image="123" ...] — l'id média n'est pas résoluble hors WP ; on émet un alt.
  h = h.replace(/\[vc_single_image\b([^\]]*)\]/g, (_m, a: string) => {
    const src = attr(a, 'source') || attr(a, 'src') || attr(a, 'image_url');
    return src ? `<img src="${escapeHtml(src)}" alt="" />` : '<div class="image-placeholder"></div>';
  });
  // Boutons : [vc_btn title="…" link="url:…|…"].
  h = h.replace(/\[vc_btn\b([^\]]*)\]/g, (_m, a: string) => {
    const title = attr(a, 'title') || 'En savoir plus';
    const link = attr(a, 'link');
    const url = link ? decodeURIComponent((link.match(/url:([^|]*)/) || [, '#'])[1] || '#') : '#';
    return `<a class="btn" href="${escapeHtml(url)}">${escapeHtml(title)}</a>`;
  });
  // Texte : [vc_column_text]…[/vc_column_text] (contenu souvent déjà HTML).
  h = h.replace(/\[vc_column_text\b[^\]]*\]/g, '<div>').replace(/\[\/vc_column_text\]/g, '</div>');
  // Titres : [vc_custom_heading text="…"].
  h = h.replace(/\[vc_custom_heading\b([^\]]*)\]/g, (_m, a: string) => {
    const text = attr(a, 'text');
    return text ? `<h2>${escapeHtml(text)}</h2>` : '';
  });
  // Structures.
  h = h
    .replace(/\[vc_row\b[^\]]*\]/g, '<section class="row">')
    .replace(/\[\/vc_row\]/g, '</section>')
    .replace(/\[vc_column\b[^\]]*\]/g, '<div class="col">')
    .replace(/\[\/vc_column\]/g, '</div>');
  // Shortcodes résiduels : balise retirée, contenu conservé.
  h = h.replace(/\[\/?[a-z0-9_]+[^\]]*\]/gi, '');
  return h.trim();
}

const wpbakeryImporter: TemplateImporter = {
  id: 'wpbakery',
  label: 'WPBakery',
  detect: detectWpBakery,
  toHtml(input: string): ImportedHtml {
    const report = newReport('wpbakery');
    const src = input ?? '';
    if (!src.trim()) {
      report.warnings.push('Entrée WPBakery vide.');
      return { html: '', report };
    }
    const html = sanitizeHtml(wpbakeryToHtml(src));
    report.warnings.push(
      'Conversion structurelle WPBakery (sans le CSS du moteur) — fidélité limitée, et les images référencées par id média ne sont pas résolues. Pour un rendu fidèle, importez l’URL de la page publiée.',
    );
    return { html, report };
  },
};

export default wpbakeryImporter;
