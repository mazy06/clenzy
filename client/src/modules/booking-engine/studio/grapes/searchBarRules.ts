import { widgetLabel } from './funnelPresets';
import { FILTER_SUB_KEYS, FILTER_SUB_LABELS, type FilterSubKey } from '../../sdk/components/FilterPanel';

/**
 * Composite « Barre de recherche » — règles de composition (niveau STANDARD).
 *
 * Rôle : collecter des critères + un déclencheur → mener aux résultats. La barre est une SECTION
 * `.clenzy-search-bar` (rangée headless) contenant des widgets granulaires de la catégorie Recherche.
 *
 * Règles (Standard) :
 *  - OBLIGATOIRE : Bouton Rechercher (déclencheur) ;
 *  - OBLIGATOIRE : au moins 1 CRITÈRE (Recherche ville | Dates | Type de logement) ;
 *  - PAR DÉFAUT activés : Dates + Voyageurs ;
 *  - OPTIONNELS : Recherche ville, Type de logement, Filtre, Devise.
 *  - Unicité : chaque widget au plus une fois. Ordre : critères → options → bouton (en dernier).
 */

export type SearchWidgetRole = 'required' | 'recommended' | 'optional';

export interface SearchWidgetSpec {
  id: string;
  /** `true` = compte comme CRITÈRE de recherche (pour la règle « ≥ 1 critère »). */
  isCriterion: boolean;
  role: SearchWidgetRole;
}

/** Catalogue ORDONNÉ des widgets utilisables dans la barre (ordre = disposition gauche→droite). */
export const SEARCH_BAR_WIDGETS: SearchWidgetSpec[] = [
  { id: 'booking-city-search', isCriterion: true, role: 'optional' },
  { id: 'booking-dates', isCriterion: true, role: 'recommended' },
  { id: 'booking-guests', isCriterion: false, role: 'recommended' },
  { id: 'booking-property-type', isCriterion: true, role: 'optional' },
  { id: 'booking-filter', isCriterion: false, role: 'optional' },
  { id: 'booking-currency', isCriterion: false, role: 'optional' },
  { id: 'booking-search-button', isCriterion: false, role: 'required' },
];

const ORDER = SEARCH_BAR_WIDGETS.map((w) => w.id);
const REQUIRED_ID = 'booking-search-button';

/** Trie une sélection selon l'ordre canonique (critères → options → bouton en dernier). */
export function orderSearchWidgets(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

/** Libellé + icône (SVG inline, trait via currentColor) par champ de la barre `.sb`. */
interface SbFieldMeta { label: string; icon: string; }
const SB_FIELDS: Record<string, SbFieldMeta> = {
  'booking-city-search': { label: 'Destination', icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' },
  'booking-dates': { label: 'Arrivée → Départ', icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' },
  'booking-guests': { label: 'Voyageurs', icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' },
  'booking-property-type': { label: 'Type de logement', icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>' },
  'booking-filter': { label: 'Filtres', icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/></svg>' },
  'booking-currency': { label: 'Devise', icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M15 9a4 4 0 1 0 0 6M8 11h6M8 13h5"/></svg>' },
};

/**
 * Barre de recherche HTML (markup `.sb`) — DYNAMIQUE selon les widgets cochés : chaque critère devient un
 * `.sb__field` (label + `.sb__control` avec icône + le VRAI champ headless éditable injecté via le marqueur),
 * le bouton devient `.sb__cta`. Le template habille `.sb-*` (cosmétique) ; le SDK fournit le défaut + le
 * structurel. Champs DIRECTS éditables (le `.sb__control` est la boîte, le widget `.cb-*` y est « nu »).
 */
export function buildSearchBarHtml(ids: string[], filterSubs?: string[] | null): string {
  const ordered = orderSearchWidgets(ids);
  const parts = ordered
    .flatMap((id) => {
      if (id === REQUIRED_ID) return [];
      // « Filtre » = bouton ICÔNE compact (pas un champ libellé) + sous-filtres choisis/ordonnés (props `subs`).
      if (id === 'booking-filter') {
        const props = filterSubs && filterSubs.length
          ? ` data-clenzy-props='${JSON.stringify({ subs: filterSubs })}'`
          : '';
        return [`<div class="sb__icon" data-clenzy-widget="booking-filter"${props}></div>`];
      }
      const meta = SB_FIELDS[id] ?? { label: widgetLabel(id), icon: '' };
      return [`<div class="sb__field"><span class="sb__label">${meta.label}</span>`
        + `<div class="sb__control">${meta.icon}<div data-clenzy-widget="${id}"></div></div></div>`];
    })
    .join('');
  const cta = ids.includes(REQUIRED_ID) ? `<div class="sb__cta" data-clenzy-widget="${REQUIRED_ID}"></div>` : '';
  return `<div class="sb" role="search" aria-label="Rechercher un logement">${parts}${cta}</div>`;
}

/** Sous-filtre du widget « Filtre » → widget CRITÈRE autonome équivalent (déplaçable un par un). */
const SUB_TO_WIDGET: Record<FilterSubKey, string> = {
  type: 'booking-property-type',
  price: 'booking-price',
  bedrooms: 'booking-bedrooms',
  bathrooms: 'booking-bathrooms',
  guests: 'booking-capacity',
  amenities: 'booking-amenities-filter',
};

/**
 * « Éclate » un widget Filtre en champs `.sb__field` autonomes (un par sous-filtre coché, ou tous par défaut),
 * chacun portant un marqueur de widget critère INDÉPENDANT (donc sélectionnable/déplaçable). Conserve le
 * libellé et la boîte `.sb__control` pour la continuité visuelle avec le reste de la barre.
 */
export function buildExplodedFilterFields(subs?: string[] | null): string {
  const keys = (subs && subs.length ? subs : [...FILTER_SUB_KEYS])
    .filter((k): k is FilterSubKey => (FILTER_SUB_KEYS as readonly string[]).includes(k));
  return [...new Set(keys)]
    .map((k) =>
      `<div class="sb__field"><span class="sb__label">${FILTER_SUB_LABELS[k]}</span>`
      + `<div class="sb__control"><div data-clenzy-widget="${SUB_TO_WIDGET[k]}"></div></div></div>`,
    )
    .join('');
}

/** Icône « filtres » (sliders) pour le déclencheur du groupe compact. */
const FILTER_GROUP_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
  + '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/>'
  + '<circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="7" cy="18" r="2" fill="currentColor"/></svg>';

/**
 * Groupe FILTRE éditable & CONSERVÉ, basculable **compact ↔ déplié** (cf. décision « les deux ») :
 *  - `.cb-filter-group__toggle` : déclencheur icône (mode compact) — verrouillé dans l'éditeur ;
 *  - `.cb-filter-group__panel`  : conteneur des sous-filtres = VRAIS widgets critères (éditables) ;
 *  - classe d'état `--expanded` (défaut : critères en ligne, éditables) / `--compact` (icône → popover).
 * Au runtime, `data-cz-filter-toggle` est hydraté (ouvre/ferme le panneau en mode compact).
 */
export function buildFilterGroupHtml(subs?: string[] | null): string {
  const fields = buildExplodedFilterFields(subs);
  return '<div class="cb-filter-group cb-filter-group--expanded" data-cz-filter>'
    + `<button type="button" class="cb-filter-group__toggle" data-cz-filter-toggle aria-label="Filtres">${FILTER_GROUP_ICON}<span class="cb-filter-group__label">Filtres</span></button>`
    + `<div class="cb-filter-group__panel cb-open">${fields}</div>`
    + '</div>';
}
