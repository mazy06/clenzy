import { type ImportedHtml, type TemplateImporter, newReport } from './TemplateImporter';
import { sanitizeHtml } from './sanitizeHtml';

/**
 * Adaptateur WordPress Gutenberg → HTML.
 *
 * Le contenu Gutenberg EST déjà du HTML, encadré par des délimiteurs en commentaires
 * (`<!-- wp:ns/name {attrs} -->` … `<!-- /wp:ns/name -->`, ou auto-fermant `<!-- wp:… /-->`).
 * Les blocs STATIQUES portent leur HTML rendu entre les délimiteurs : on retire donc simplement les
 * commentaires de blocs et on conserve le HTML interne. Les blocs DYNAMIQUES (rendus par PHP au runtime,
 * ex. derniers articles) n'ont pas de HTML ici → ils disparaissent (signalé dans le rapport).
 */
function detectGutenberg(input: string): boolean {
  return (input ?? '').includes('<!-- wp:');
}

/** Retire tous les délimiteurs de blocs Gutenberg (ouvrants, fermants, auto-fermants). */
function stripBlockComments(input: string): string {
  return input.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '').trim();
}

const gutenbergImporter: TemplateImporter = {
  id: 'gutenberg',
  label: 'WordPress (Gutenberg)',
  detect: detectGutenberg,
  toHtml(input: string): ImportedHtml {
    const report = newReport('gutenberg');
    const src = input ?? '';
    if (!src.trim()) {
      report.warnings.push('Entrée Gutenberg vide.');
      return { html: '', report };
    }
    const html = sanitizeHtml(stripBlockComments(src));
    report.notes =
      'Délimiteurs de blocs retirés ; le HTML des blocs statiques est conservé. Les blocs dynamiques (rendus côté serveur) n’apparaissent pas — préférez l’import URL de la page rendue pour une fidélité complète.';
    return { html, report };
  },
};

export default gutenbergImporter;
