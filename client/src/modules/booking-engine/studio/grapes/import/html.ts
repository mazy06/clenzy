import { type ImportedHtml, type TemplateImporter, newReport } from './TemplateImporter';
import { sanitizeHtml } from './sanitizeHtml';

/**
 * Adaptateur HTML brut — fallback UNIVERSEL de l'« Importer ».
 *
 * `detect` renvoie toujours `true` : c'est le dernier maillon de la chaîne de détection (cf. `registry`),
 * il accepte n'importe quelle entrée comme du HTML. À ce titre, le stub fondation est déjà fonctionnel :
 * il assainit l'entrée et la renvoie telle quelle (aucune conversion spécifique à appliquer).
 */
const htmlImporter: TemplateImporter = {
  id: 'html',
  label: 'HTML',
  detect: () => true,
  toHtml(input: string): ImportedHtml {
    const report = newReport('html');
    return { html: sanitizeHtml(input ?? ''), report };
  },
};

export default htmlImporter;
