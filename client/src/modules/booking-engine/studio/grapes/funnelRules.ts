import { widgetLabel } from './funnelPresets';

/**
 * Règles de COMPOSITION d'un parcours : « on ne compose pas tout avec tout ». Modèle par CAPACITÉS —
 * un widget PEUT fournir et/ou requérir des capacités. Validation NON bloquante, sur deux niveaux :
 *  - `warning` : vrai prérequis manquant DANS le parcours (ex. paiement sans dates) ;
 *  - `info`    : suggestion (souvent navigationnelle — la dépendance peut vivre sur une AUTRE page,
 *                ex. un bouton Rechercher qui mène à une page de résultats).
 *
 * Volontairement CONSERVATEUR : les 7 modèles intégrés produisent ZÉRO alerte (ni warning ni info).
 */
export type WidgetCapability = 'dates' | 'cart-item' | 'checkout' | 'results';
export type WarningSeverity = 'warning' | 'info';

/** Ce que chaque widget FOURNIT au parcours. */
const PROVIDES: Record<string, WidgetCapability[]> = {
  'booking-dates': ['dates'],
  search: ['dates'], // barre composite (ville + dates + voyageurs + bouton) → fournit les dates
  'booking-add-to-cart': ['cart-item'],
  'booking-checkout-button': ['checkout'],
  'booking-cart': ['checkout'],
  'booking-guest-form': ['checkout'], // le submit du formulaire déclenche le paiement
  'booking-property-results': ['results'],
};

/** Prérequis DURS (niveau `warning`) : doivent être présents dans le parcours. */
const REQUIRES: Record<string, WidgetCapability[]> = {
  'booking-price-summary': ['dates'],
  'booking-add-to-cart': ['dates'],
  'booking-checkout-button': ['dates'],
  'booking-cart': ['cart-item'],
  'booking-addons': ['checkout'],
};

/** Suggestions (niveau `info`) : utiles, mais peuvent vivre sur une autre page (navigationnel). */
const SUGGESTS: Record<string, WidgetCapability[]> = {
  'booking-search-button': ['results'],
  search: ['results'],
  'booking-add-to-cart': ['checkout'],
};

/** Libellé lisible d'une capacité (pour le message). */
const CAPABILITY_HINT: Record<WidgetCapability, string> = {
  dates: 'un sélecteur de Dates',
  'cart-item': 'un bouton « Ajouter au panier » en amont',
  checkout: 'un moyen de finaliser (Bouton de paiement, Panier ou Coordonnées voyageur)',
  results: 'un affichage des résultats (« Logements disponibles »), ici ou sur une page reliée',
};

export interface CompositionWarning {
  widgetId: string;
  capability: WidgetCapability;
  severity: WarningSeverity;
  message: string;
}

/**
 * Valide une composition (liste ordonnée d'ids widgets) → alertes de prérequis/suggestions.
 * Présence (pas ordre strict) : un funnel = une section où tout s'affiche ensemble.
 */
export function validateComposition(widgetIds: string[]): CompositionWarning[] {
  const provided = new Set<WidgetCapability>();
  for (const id of widgetIds) for (const cap of PROVIDES[id] ?? []) provided.add(cap);

  const out: CompositionWarning[] = [];
  const seen = new Set<string>();
  const collect = (table: Record<string, WidgetCapability[]>, severity: WarningSeverity) => {
    for (const id of widgetIds) {
      for (const cap of table[id] ?? []) {
        if (provided.has(cap)) continue;
        const key = `${severity}:${id}:${cap}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const verb = severity === 'warning' ? 'nécessite' : ': pensez à';
        out.push({ widgetId: id, capability: cap, severity, message: `« ${widgetLabel(id)} » ${verb} ${CAPABILITY_HINT[cap]}.` });
      }
    }
  };
  // Warnings d'abord (prérequis durs), puis infos (suggestions).
  collect(REQUIRES, 'warning');
  collect(SUGGESTS, 'info');
  return out;
}
