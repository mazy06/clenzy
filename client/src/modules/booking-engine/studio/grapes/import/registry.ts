import type { ImportedHtml, TemplateImporter } from './TemplateImporter';
import gutenbergImporter from './gutenberg';
import elementorImporter from './elementor';
import grapesjsImporter from './grapesjs';
import wpbakeryImporter from './wpbakery';
import diviImporter from './divi';
import beaverImporter from './beaver';
import webflowImporter from './webflow';
import markdownImporter from './markdown';
import htmlImporter from './html';

/**
 * Registre des adaptateurs d'import (modèle HTML+CSS).
 *
 * ORDRE DE DÉTECTION = du PLUS SPÉCIFIQUE au PLUS GÉNÉRIQUE. Le premier `detect(input)` vrai gagne.
 * Invariants :
 *   - `html` est TOUJOURS en DERNIER : son `detect` renvoie `true` pour tout (fallback universel).
 *   - `markdown` passe AVANT `html` : du Markdown est aussi du « texte » que le fallback HTML accepterait.
 * Les formats à signature forte (commentaires Gutenberg, shortcodes Divi/WPBakery/Beaver, JSON Elementor/
 * GrapesJS, markup Webflow) viennent en tête car leurs heuristiques sont peu ambiguës.
 */
export const IMPORTERS: TemplateImporter[] = [
  gutenbergImporter,
  elementorImporter,
  grapesjsImporter,
  wpbakeryImporter,
  diviImporter,
  beaverImporter,
  webflowImporter,
  markdownImporter,
  htmlImporter,
];

/**
 * Détecte l'adaptateur correspondant à l'entrée (premier `detect` vrai selon l'ordre du registre).
 * Ne renvoie jamais `undefined` en pratique : `html` capture tout en dernier recours.
 */
export function detectImporter(input: string): TemplateImporter {
  for (const importer of IMPORTERS) {
    try {
      if (importer.detect(input)) return importer;
    } catch {
      /* un detect défaillant ne doit pas bloquer la chaîne : on passe au suivant */
    }
  }
  return htmlImporter;
}

/**
 * Convertit une entrée brute en `{ html, css, report }`. `forceId` permet de court-circuiter la
 * détection (ex. l'utilisateur a explicitement choisi un format dans l'UI) ; sinon auto-détection.
 * Tout échec de l'adaptateur est rattrapé en repli HTML assaini (jamais d'exception remontée à l'UI).
 */
export function importToHtml(input: string, forceId?: string): ImportedHtml {
  const importer =
    (forceId ? IMPORTERS.find((i) => i.id === forceId) : undefined) ?? detectImporter(input);
  try {
    return importer.toHtml(input);
  } catch {
    // Repli ultime : on ne perd jamais l'entrée, on la traite comme du HTML brut (assaini en aval).
    const fallback = htmlImporter.toHtml(input);
    fallback.report.warnings.push(
      `La conversion « ${importer.label} » a échoué ; contenu traité comme HTML brut.`,
    );
    return fallback;
  }
}
