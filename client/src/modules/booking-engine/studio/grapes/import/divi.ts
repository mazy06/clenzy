import { type ImportedHtml, type TemplateImporter, newReport, escapeHtml } from './TemplateImporter';
import { sanitizeHtml } from './sanitizeHtml';

/**
 * Adaptateur Divi (Elegant Themes) — shortcodes `[et_pb_*]`.
 *
 * Les shortcodes Divi ne portent PAS le CSS final (généré au runtime par le moteur Divi) → on produit
 * une structure HTML best-effort (sections/colonnes/textes/images/boutons). FIDÉLITÉ LIMITÉE : pour un
 * rendu fidèle, préférer l'import URL de la page publiée. Ne jette jamais.
 */
function detectDivi(input: string): boolean {
  return /\[et_pb_section\b/.test(input ?? '');
}

/** Extrait la valeur d'un attribut `name="value"` d'une chaîne d'attributs de shortcode. */
function attr(raw: string, name: string): string {
  const m = raw.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : '';
}

function diviToHtml(input: string): string {
  let h = input;
  // Images : [et_pb_image src="…" alt="…"].
  h = h.replace(/\[et_pb_image\b([^\]]*)\](?:[\s\S]*?\[\/et_pb_image\])?/g, (_m, a: string) => {
    const src = attr(a, 'src');
    return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(attr(a, 'alt'))}" />` : '';
  });
  // Boutons : [et_pb_button button_text="…" button_url="…"].
  h = h.replace(/\[et_pb_button\b([^\]]*)\](?:\[\/et_pb_button\])?/g, (_m, a: string) => {
    const text = attr(a, 'button_text') || 'En savoir plus';
    const url = attr(a, 'button_url') || '#';
    return `<a class="btn" href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
  });
  // Blurb : titre + contenu.
  h = h.replace(/\[et_pb_blurb\b([^\]]*)\]/g, (_m, a: string) => {
    const title = attr(a, 'title');
    return `<div class="blurb">${title ? `<h3>${escapeHtml(title)}</h3>` : ''}`;
  });
  h = h.replace(/\[\/et_pb_blurb\]/g, '</div>');
  // Structures (le contenu interne — souvent déjà du HTML — est conservé).
  h = h
    .replace(/\[et_pb_section\b[^\]]*\]/g, '<section>')
    .replace(/\[\/et_pb_section\]/g, '</section>')
    .replace(/\[et_pb_row\b[^\]]*\]/g, '<div class="row">')
    .replace(/\[\/et_pb_row\]/g, '</div>')
    .replace(/\[et_pb_column\b[^\]]*\]/g, '<div class="col">')
    .replace(/\[\/et_pb_column\]/g, '</div>')
    .replace(/\[et_pb_text\b[^\]]*\]/g, '<div>')
    .replace(/\[\/et_pb_text\]/g, '</div>');
  // Tout shortcode résiduel : on retire la balise, on garde le contenu.
  h = h.replace(/\[\/?[a-z0-9_]+[^\]]*\]/gi, '');
  return h.trim();
}

const diviImporter: TemplateImporter = {
  id: 'divi',
  label: 'Divi',
  detect: detectDivi,
  toHtml(input: string): ImportedHtml {
    const report = newReport('divi');
    const src = input ?? '';
    if (!src.trim()) {
      report.warnings.push('Entrée Divi vide.');
      return { html: '', report };
    }
    const html = sanitizeHtml(diviToHtml(src));
    report.warnings.push(
      'Conversion structurelle Divi (sans le CSS du moteur Divi) — fidélité limitée. Pour un rendu fidèle, importez l’URL de la page publiée.',
    );
    return { html, report };
  },
};

export default diviImporter;
