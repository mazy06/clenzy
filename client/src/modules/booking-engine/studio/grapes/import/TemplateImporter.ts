/**
 * Contrats de l'« Importer » du Studio GrapesJS — modèle ORIENTÉ HTML+CSS.
 *
 * Différence FONDAMENTALE avec l'ancienne couche `builder/import/*` (morte, BlockInstance/IR) : ici tout
 * converge vers du HTML+CSS, car GrapesJS est nourri par `setComponents(html)` + `Css.addRules(css)`.
 * Chaque format externe (WordPress Gutenberg, Elementor, Divi, Beaver, WPBakery, GrapesJS, Webflow,
 * Markdown, HTML brut) est normalisé vers `{ html, css }` par un ADAPTATEUR `TemplateImporter`.
 *
 * Ce fichier expose UNIQUEMENT des contrats + helpers réutilisables (aucune logique d'adaptateur, aucun
 * `BlockInstance`). Les adaptateurs vivent dans `./html`, `./gutenberg`, `./elementor`, etc., et sont
 * implémentés par l'agent D (ici : stubs).
 */

/** Rapport de compatibilité post-import (affiché à l'utilisateur après injection). */
export interface ImportReport {
  /** Identifiant du format source détecté (= `TemplateImporter.id`). */
  source: string;
  /** Avertissements lisibles (dégradations, balises retirées, éléments approximés…). */
  warnings: string[];
  /** Note libre optionnelle (résumé, conseil de relecture…). */
  notes?: string;
}

/** Résultat d'un import : HTML + CSS prêts à injecter dans GrapesJS + le rapport. */
export interface ImportedHtml {
  /** Corps HTML extrait/converti (sera RÉ-assaini avant injection — cf. `loadIntoEditor`). */
  html: string;
  /** CSS associé (feuilles + styles agrégés), ou absent si le format n'en porte pas. */
  css?: string;
  /** Rapport de compatibilité. */
  report: ImportReport;
}

/**
 * Adaptateur d'un format externe (Open/Closed : ajouter un format = +1 fichier + 1 entrée registry).
 * `detect` reconnaît le format rapidement (heuristique, sans tout parser). `toHtml` convertit vers
 * `{ html, css, report }` et NE LANCE JAMAIS sur du contenu inattendu (au pire : HTML vide + warning).
 */
export interface TemplateImporter {
  /** Identifiant stable du format (= `ImportReport.source`). En anglais. */
  id: string;
  /** Libellé UI du format (affiché dans le sélecteur / le rapport). */
  label: string;
  /** Reconnaît le format à partir de l'entrée brute (rapide, heuristique, sans effet de bord). */
  detect(input: string): boolean;
  /** Convertit l'entrée vers HTML+CSS + rapport. Ne jette pas (contenu inattendu → html vide + warning). */
  toHtml(input: string): ImportedHtml;
}

// ─── Helpers réutilisables par les adaptateurs ────────────────────────────────────────────────

/** Crée un rapport vierge pour la source donnée. */
export function newReport(source: string): ImportReport {
  return { source, warnings: [] };
}

/**
 * Échappe les caractères HTML spéciaux d'une chaîne (texte → contenu HTML sûr). Utilisé par les
 * adaptateurs qui injectent du texte utilisateur (ex. Markdown → balises) dans du HTML construit.
 * Aligné sur `StringUtils.escapeHtml` côté serveur (même jeu de caractères).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
