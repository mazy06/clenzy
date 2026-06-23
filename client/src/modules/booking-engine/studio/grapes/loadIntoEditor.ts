import type { Editor } from 'grapesjs';
import { sanitizeHtml, sanitizeCss } from './import/sanitizeHtml';

/**
 * Charge un contenu HTML+CSS dans l'éditeur GrapesJS, après assainissement.
 *
 * Point d'injection UNIQUE pour tout l'« Importer » (URL / coller / fichier / galerie) :
 *   1. assainit le HTML et le CSS (conservateur, sans dépendance npm) ;
 *   2. `setComponents(html)` REMPLACE le corps de la page courante ;
 *   3. `Css.addRules(css)` AJOUTE les règles importées (n'écrase pas le CSS de thème du canvas).
 *
 * ⚠️ NON VÉRIFIÉ AU NAVIGATEUR (login Keycloak requis) : le rendu réel du pipeline
 * setComponents/addRules est à valider manuellement dans le Studio.
 */
export interface HtmlAndCss {
  html: string;
  css?: string;
}

export function loadHtmlIntoEditor(editor: Editor, { html, css }: HtmlAndCss): void {
  const safeHtml = sanitizeHtml(html ?? '');
  const safeCss = sanitizeCss(css ?? '');
  editor.setComponents(safeHtml);
  if (safeCss.trim()) {
    editor.Css.addRules(safeCss);
  }
}
