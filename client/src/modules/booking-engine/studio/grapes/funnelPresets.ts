import { BOOKING_WIDGET_DEFS } from './bookingWidgetDefs';
import i18n from '../../../../i18n/config';

/**
 * Parcours de réservation (« funnel ») = composition ORDONNÉE de widgets booking, insérée dans une
 * section `.clenzy-funnel`. Un preset peut être INTÉGRÉ (défini ici, `builtin: true`) ou PERSONNALISÉ
 * (créé par l'utilisateur, sauvegardé en JSON dans `config.funnelPresets`). Cf. `FunnelPicker`.
 */
export interface FunnelPreset {
  /** Id stable (slug pour les intégrés, généré pour les custom). */
  id: string;
  /** Nom affiché — libellé brut pour un preset custom (donnee utilisateur). */
  label: string;
  /** Cle du nom pour un preset integre ; prime sur `label`. */
  labelKey?: string;
  /** Description courte. */
  description?: string;
  /** Cle de la description pour un preset integre. */
  descriptionKey?: string;
  /** Ids ordonnés des widgets booking (cf. `bookingWidgetDefs`). */
  widgetIds: string[];
  /**
   * Noms d'écrans curatés pour la visualisation du parcours (étapes + flèches dans la carte).
   * Plus grossiers que la liste de widgets (ex. « Recherche » regroupe ville/dates/voyageurs). Presets
   * intégrés uniquement ; NON sérialisé → les customs dérivent leur flux des libellés de widgets.
   */
  steps?: string[];
  /** Cles des ecrans pour un preset integre. */
  stepKeys?: string[];
  /** Badge court affiché à côté du titre (« Populaire », « Sans paiement »…). NON sérialisé. */
  badge?: string;
  /** Cle du badge pour un preset integre. */
  badgeKey?: string;
  /** `true` = preset livré en code ; absent/false = preset custom de l'org. */
  builtin?: boolean;
}

/**
 * Parcours intégrés — 7 logiques pensées pour couvrir l'essentiel des sites (repensées de zéro) :
 *  1. Recherche catalogue (multi-logements)   2. Logement unique (mono-bien, fiche → paiement)
 *  3. Demande de devis (lead, sans paiement)   4. Séjour + extras (upsell → paiement)
 *  5. Panier multi-séjours (groupé)            6. Réservation express (paiement 1-écran)
 *  7. Page de confirmation (écran de retour post-paiement)
 * Le #3 utilise `booking-inquiry-form` (soumission « demande » → endpoint inquiry, pas Stripe). Les #2/#4/#6
 * se terminent par `booking-checkout-button` (paiement Stripe). Le #7 est un bloc de page de RETOUR
 * (`booking-confirmation`) — à ne pas mettre inline dans un parcours linéaire (il s'afficherait toujours).
 */
export const BUILTIN_FUNNEL_PRESETS: FunnelPreset[] = [
  {
    id: 'catalogue',
    labelKey: 'funnels.catalogue.label',
    descriptionKey: 'funnels.catalogue.description',
    badgeKey: 'funnels.badges.popular',
    stepKeys: ['funnels.steps.search', 'funnels.steps.properties', 'funnels.steps.priceSummary'],
    label: 'Recherche catalogue',    badge: 'Populaire',
    description: 'Plusieurs logements à explorer puis réserver en direct.',
    steps: ['Recherche', 'Logements', 'Récap prix'],
    widgetIds: ['booking-city-search', 'booking-dates', 'booking-guests', 'booking-property-type', 'booking-search-button', 'booking-property-results', 'booking-price-summary'],
    builtin: true,
  },
  {
    id: 'single',
    labelKey: 'funnels.single.label',
    descriptionKey: 'funnels.single.description',
    stepKeys: ['funnels.steps.theProperty', 'funnels.steps.datesQuote', 'funnels.steps.pay'],
    label: 'Logement unique',    description: 'Un seul bien, sur une page : sa fiche, ses équipements, le devis instantané et le paiement.',
    steps: ['Le logement', 'Dates & devis', 'Payer'],
    widgetIds: ['booking-property-summary', 'booking-amenities', 'booking-dates', 'booking-guests', 'booking-price-summary', 'booking-checkout-button'],
    builtin: true,
  },
  {
    id: 'inquiry',
    labelKey: 'funnels.inquiry.label',
    descriptionKey: 'funnels.inquiry.description',
    badgeKey: 'funnels.badges.noPayment',
    stepKeys: ['funnels.steps.datesGuests', 'funnels.steps.contact', 'funnels.steps.requestSent'],
    label: 'Demande de devis',    badge: 'Sans paiement',
    description: 'Le voyageur envoie une demande, vous répondez avec un devis.',
    steps: ['Dates & voyageurs', 'Coordonnées', 'Demande envoyée'],
    widgetIds: ['booking-dates', 'booking-guests', 'booking-inquiry-form'],
    builtin: true,
  },
  {
    id: 'extras',
    labelKey: 'funnels.extras.label',
    descriptionKey: 'funnels.extras.description',
    badgeKey: 'funnels.badges.upsell',
    stepKeys: ['funnels.steps.property', 'funnels.steps.optionsExtras', 'funnels.steps.summary', 'funnels.steps.payment'],
    label: 'Séjour + extras',    badge: 'Upsell',
    description: 'Ajoutez options et extras avant le paiement pour augmenter le panier.',
    steps: ['Logement', 'Options & extras', 'Récap', 'Paiement'],
    widgetIds: ['booking-dates', 'booking-guests', 'booking-property-results', 'booking-addons', 'booking-price-summary', 'booking-checkout-button'],
    builtin: true,
  },
  {
    id: 'cart',
    labelKey: 'funnels.cart.label',
    descriptionKey: 'funnels.cart.description',
    stepKeys: ['funnels.steps.search', 'funnels.steps.cartN', 'funnels.steps.payment'],
    label: 'Panier multi-séjours',    description: 'Plusieurs réservations groupées dans un même panier.',
    steps: ['Recherche', 'Panier ×N', 'Paiement'],
    widgetIds: ['booking-city-search', 'booking-dates', 'booking-guests', 'booking-property-results', 'booking-add-to-cart', 'booking-cart'],
    builtin: true,
  },
  {
    id: 'express',
    labelKey: 'funnels.express.label',
    descriptionKey: 'funnels.express.description',
    badgeKey: 'funnels.badges.oneScreen',
    stepKeys: ['funnels.steps.datesGuests', 'funnels.steps.payNow'],
    label: 'Réservation express',    badge: '1 écran · rapide',
    description: 'Friction minimale (1 écran, bien implicite) : dates, voyageurs, total, paiement immédiat.',
    steps: ['Dates & voyageurs', 'Payer maintenant'],
    widgetIds: ['booking-dates', 'booking-guests', 'booking-price-summary', 'booking-checkout-button'],
    builtin: true,
  },
  {
    id: 'confirmation',
    labelKey: 'funnels.confirmation.label',
    descriptionKey: 'funnels.confirmation.description',
    badgeKey: 'funnels.badges.returnPage',
    stepKeys: ['funnels.steps.confirmation'],
    label: 'Page de confirmation',    badge: 'Page de retour',
    description: 'À placer sur la page de retour après paiement : remerciement, référence et récapitulatif.',
    steps: ['Confirmation'],
    widgetIds: ['booking-confirmation'],
    builtin: true,
  },
];

/** Libellé d'un widget par id (pour l'aperçu d'un preset). */
export function widgetLabel(id: string): string {
  const def = BOOKING_WIDGET_DEFS.find((d) => d.id === id);
  return def ? i18n.t(def.labelKey) : id;
}

/** Section HTML d'un parcours à partir d'une liste ORDONNÉE d'ids widgets (classe `clenzy-funnel`). */
export function buildFunnelHtml(widgetIds: string[]): string {
  const items = widgetIds.map((id) => `<div data-clenzy-widget="${id}"></div>`).join('');
  return `<section class="clenzy-funnel">${items}</section>`;
}

/** Lit les presets custom stockés en JSON dans `config.funnelPresets` (tolérant aux données invalides). */
export function parseSavedPresets(json: string | null | undefined): FunnelPreset[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p): p is FunnelPreset =>
        !!p && typeof p === 'object'
        && typeof (p as FunnelPreset).id === 'string'
        && typeof (p as FunnelPreset).label === 'string'
        && Array.isArray((p as FunnelPreset).widgetIds),
    );
  } catch {
    return [];
  }
}

/** Sérialise les presets custom pour `config.funnelPresets`. */
export function serializeSavedPresets(presets: FunnelPreset[]): string {
  return JSON.stringify(presets.map(({ id, label, description, widgetIds }) => ({ id, label, description, widgetIds })));
}
