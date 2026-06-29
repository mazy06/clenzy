import { buildFunnelHtml } from './funnelPresets';
import { buildSearchBarHtml } from './searchBarRules';

/**
 * Widgets COMPOSITES : compositions nommées et réutilisables de widgets granulaires (ex. barre de
 * recherche). Disponibles dans l'onglet « Composites » du panneau droit (P1) ; créés via l'écran de
 * création (P2) ; persistés par org dans `config.compositeWidgets` (P3, comme `funnelPresets`).
 *
 * 3 types de disposition :
 *  - `searchBar` : barre de recherche réglée (cf. `searchBarRules`) → section `.clenzy-search-bar` ;
 *  - `row`       : rangée générique → section `.clenzy-row` ;
 *  - `column`    : colonne générique → section `.clenzy-funnel`.
 */
export type CompositeKind = 'searchBar' | 'row' | 'column';

export interface CompositeWidget {
  /** Id stable (slug intégré ou généré pour les customs). */
  id: string;
  /** Nom affiché dans la palette. */
  name: string;
  /** Markup LIBRE issu du mini-éditeur DnD (source de vérité du rendu si présent). */
  html?: string;
  /** LEGACY (composites créés avant le mini-éditeur DnD) : type de disposition. */
  kind?: CompositeKind;
  /** LEGACY : ids ordonnés des widgets granulaires (cf. `bookingWidgetDefs`). */
  widgetIds?: string[];
  /** LEGACY : sous-filtres du widget « Filtre » (type, price, bedrooms, bathrooms, guests, amenities). */
  filterSubs?: string[];
  /** `true` = composite livré en code ; absent/false = composite custom de l'org. */
  builtin?: boolean;
  /** `true` = composite de la bibliothèque GLOBALE plateforme (partagé à tous les engines, géré par
   *  les SUPER_ADMIN/SUPER_MANAGER). Marqueur runtime — NON persisté (la source est la lib globale). */
  global?: boolean;
}

/** Sous-titre court pour la palette : « N widgets » (compte les marqueurs `data-clenzy-widget` du markup). */
export function compositeSummary(c: CompositeWidget): string {
  const ids = c.widgetIds ?? (typeof c.html === 'string' ? c.html.match(/data-clenzy-widget=/g) ?? [] : []);
  const n = ids.length;
  const head = c.kind ? `${COMPOSITE_KIND_LABELS[c.kind]} · ` : '';
  return `${head}${n} widget${n > 1 ? 's' : ''}`;
}

export const COMPOSITE_KIND_LABELS: Record<CompositeKind, string> = {
  searchBar: 'Barre de recherche',
  row: 'Ligne',
  column: 'Colonne',
};

/**
 * Composites INTÉGRÉS : AUCUN. La bibliothèque est 100 % custom — elle reste vide tant que l'utilisateur
 * n'a pas créé ses propres composites (rien n'est codé en dur dans la palette).
 */
export const BUILTIN_COMPOSITES: CompositeWidget[] = [];

/** Markup INTERNE d'un composite (sections headless `.sb`/`.clenzy-*`), SANS enveloppe — chargé tel quel
 *  dans le canvas du constructeur (stockage propre). Pour le RENDU sur page, utiliser `buildCompositeHtml`. */
export function buildCompositeInner(c: CompositeWidget): string {
  // Mini-éditeur DnD : le markup libre est la source de vérité.
  if (typeof c.html === 'string' && c.html.trim()) return c.html;
  // LEGACY (kind + widgetIds) — composites créés avant le mini-éditeur DnD.
  const ids = c.widgetIds ?? [];
  if (c.kind === 'searchBar') return buildSearchBarHtml(ids, c.filterSubs);
  if (c.kind === 'row') {
    const items = ids.map((id) => `<div data-clenzy-widget="${id}"></div>`).join('');
    return `<section class="clenzy-row">${items}</section>`;
  }
  return buildFunnelHtml(ids); // column → .clenzy-funnel
}

/** Classe de l'enveloppe `.cb-widget` du composite (porteuse des tokens `--cb-*`). */
const COMPOSITE_SHELL_CLASS = 'cz-composite';

/**
 * Section HTML d'un composite pour le RENDU sur page, ENVELOPPÉE dans un `.cb-widget`.
 *
 * Pourquoi l'enveloppe : un composite assemble des widgets-feuilles (`.cb-widget`) dans des wrappers de
 * disposition (`.sb__*`, `.clenzy-*`) situés AU-DESSUS des feuilles. Les tokens `--cb-*` étant posés sur
 * `.cb-widget` (skin baké du template), ces wrappers n'hériteraient SINON aucun token → composite non stylé.
 * En faisant porter `.cb-widget` par la racine, toute la composition hérite les tokens du template
 * (couleurs/surface/bordure/rayon) — sans migration. Idempotent (ne ré-enveloppe pas un markup déjà enveloppé).
 */
export function buildCompositeHtml(c: CompositeWidget): string {
  const inner = buildCompositeInner(c);
  if (new RegExp(`class="[^"]*\\b${COMPOSITE_SHELL_CLASS}\\b`).test(inner)) return inner;
  return `<div class="cb-widget ${COMPOSITE_SHELL_CLASS}">${inner}</div>`;
}

/** Lit les composites custom stockés en JSON dans `config.compositeWidgets` (tolérant aux données invalides). */
export function parseSavedComposites(json: string | null | undefined): CompositeWidget[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (c): c is CompositeWidget =>
        !!c && typeof c === 'object'
        && typeof (c as CompositeWidget).id === 'string'
        && typeof (c as CompositeWidget).name === 'string'
        // Valide si markup libre (mini-éditeur) OU legacy (widgetIds + kind).
        && (typeof (c as CompositeWidget).html === 'string'
          || (Array.isArray((c as CompositeWidget).widgetIds)
            && ['searchBar', 'row', 'column'].includes((c as CompositeWidget).kind as string))),
    );
  } catch {
    return [];
  }
}

/** Sérialise les composites custom pour `config.compositeWidgets`. */
export function serializeSavedComposites(list: CompositeWidget[]): string {
  return JSON.stringify(list.map(({ id, name, html, kind, widgetIds, filterSubs }) => ({ id, name, html, kind, widgetIds, filterSubs })));
}
