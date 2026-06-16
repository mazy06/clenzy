/**
 * Type des micro-widgets SDK (pont `BaitlyWidget.buildLayoutWidget`). Co-localisé ici depuis le
 * retrait du builder de blocs legacy : c'est désormais le monde GrapesJS qui porte ce contrat.
 * Chaque littéral a un équivalent fonctionnel côté SDK.
 */
export type WidgetType =
  // Recherche
  | 'citySearch'
  | 'dates'
  | 'guests'
  | 'propertyType'
  | 'filter'
  | 'currency'
  | 'searchButton'
  // Résultats & récap
  | 'propertyResults'
  | 'priceSummary'
  // Panier
  | 'cart'
  | 'addToCart'
  | 'addons'
  // Coordonnées & réservation
  | 'stepper'
  | 'guestForm'
  // Compte
  | 'account'
  | 'rebook'
  // Conteneur
  | 'group';

/** Props d'un micro-widget (valeurs scalaires sérialisables). */
export type WidgetProps = Record<string, string | number | boolean>;

/**
 * Définitions des widgets de réservation Clenzy montés DANS l'éditeur GrapesJS (couture G2).
 *
 * Une `BookingWidgetDef` est la forme STABLE qui suffit à `registerBookingComponents` pour créer,
 * pour CHAQUE widget :
 *   1. un bloc drag&drop dans le BlockManager (`label`, `category`, `icon`),
 *   2. un type de composant GrapesJS qui monte le micro-widget SDK correspondant dans le canvas.
 *
 * Le pont avec le SDK est `widgetType` : chaque def cible un micro-widget du SDK
 * (cf. `WidgetType` ci-dessous, mappé par `BaitlyWidget.buildLayoutWidget`). Le composant
 * GrapesJS sérialise `{ widgetLayout: [{ type: widgetType, props }], styleMode }` comme
 * `componentConfig` pour monter UNIQUEMENT ce micro-widget via le SDK réel.
 *
 * G1 ne fournit QUE la def `booking-widget` (expérience de réservation complète : layout vide ⇒ le
 * SDK rend le formulaire de recherche par défaut). G2 ajoutera les 16 autres (un `WidgetType` chacun :
 * citySearch, dates, guests, propertyResults, cart, guestForm, etc.) en poussant des entrées dans
 * `BOOKING_WIDGET_DEFS` — sans toucher à `bookingComponents.ts`.
 */

/** Géométrie d'une icône SVG (style lucide) sérialisable en DOM sûr (aucun innerHTML). */
export interface BookingIconShape {
  /** Nœuds enfants du `<svg>` (rect, path, circle, line…). */
  paths: { tag: string; attrs: Record<string, string> }[];
}

/**
 * Forme stable d'un widget de réservation pour le Studio GrapesJS.
 * Identifiants en anglais ; ce contrat est consommé tel quel par `registerBookingComponents`.
 */
export interface BookingWidgetDef {
  /**
   * Type de composant GrapesJS (unique, stable). Sert d'ancre `isComponent` au rechargement et de
   * clé de bloc. Le marqueur exporté est `data-clenzy-widget="<id>"`.
   */
  id: string;
  /** Libellé affiché (bloc + nom de calque). */
  label: string;
  /** Catégorie du BlockManager (regroupement de la palette). */
  category: string;
  /** Icône du bloc (DOM sûr, contenu 100 % statique). */
  icon: BookingIconShape;
  /**
   * Micro-widget SDK ciblé (pont `BaitlyWidget.buildLayoutWidget`). `null` = expérience de
   * réservation COMPLÈTE (layout vide ⇒ formulaire de recherche par défaut du SDK).
   */
  widgetType: WidgetType | null;
  /** Props du micro-widget (sérialisées dans `componentConfig.widgetLayout[0].props`). */
  defaultProps?: WidgetProps;
}

/** Attribut-marqueur émis à l'export (ancre d'hydratation SDK/SSR). Valeur = `BookingWidgetDef.id`. */
export const BOOKING_WIDGET_ATTR = 'data-clenzy-widget';

/** Type historique du widget de réservation complet (compat G0 : marqueur `data-clenzy-widget="booking"`). */
export const BOOKING_WIDGET_TYPE = 'booking-widget';
/** Valeur de marqueur du widget de réservation complet (rétro-compatible avec le projet G0). */
export const BOOKING_WIDGET_ATTR_VALUE = 'booking';

/** Catégorie unique du BlockManager pour tous les widgets de réservation. */
const CATEGORY = 'Clenzy/Réservation';

/* ── Icônes SVG statiques (alignées sur lucide-react, mêmes glyphes que `widgetRegistry`) ──
 * Chaque icône est un DOM 100 % statique (aucun innerHTML) construit par `bookingComponents.buildIcon`. */

/** Calendrier coché — widget de réservation COMPLET (lucide `CalendarCheck`). */
const CALENDAR_ICON: BookingIconShape = {
  paths: [
    { tag: 'rect', attrs: { x: '3', y: '4', width: '18', height: '18', rx: '2' } },
    { tag: 'path', attrs: { d: 'M16 2v4M8 2v4M3 10h18' } },
    { tag: 'path', attrs: { d: 'm9 16 2 2 4-4' } },
  ],
};

/** Loupe — recherche ville (lucide `Search`). */
const SEARCH_ICON: BookingIconShape = {
  paths: [
    { tag: 'circle', attrs: { cx: '11', cy: '11', r: '8' } },
    { tag: 'path', attrs: { d: 'm21 21-4.3-4.3' } },
  ],
};

/** Calendrier — sélecteur de dates (lucide `CalendarDays`). */
const CALENDAR_DAYS_ICON: BookingIconShape = {
  paths: [
    { tag: 'rect', attrs: { x: '3', y: '4', width: '18', height: '18', rx: '2' } },
    { tag: 'path', attrs: { d: 'M16 2v4M8 2v4M3 10h18' } },
    { tag: 'path', attrs: { d: 'M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01' } },
  ],
};

/** Groupe de personnes — voyageurs (lucide `Users`). */
const USERS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' } },
    { tag: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
    { tag: 'path', attrs: { d: 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' } },
  ],
};

/** Maison — type de logement (lucide `Home`). */
const HOME_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' } },
    { tag: 'path', attrs: { d: 'M9 22V12h6v10' } },
  ],
};

/** Curseurs — filtre (lucide `SlidersHorizontal`). */
const SLIDERS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3' } },
    { tag: 'path', attrs: { d: 'M14 2v4M8 10v4M16 18v4' } },
  ],
};

/** Pièces — devise (lucide `Coins`). */
const COINS_ICON: BookingIconShape = {
  paths: [
    { tag: 'circle', attrs: { cx: '8', cy: '8', r: '6' } },
    { tag: 'path', attrs: { d: 'M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82' } },
  ],
};

/** Flèche droite — bouton Rechercher (lucide `ArrowRight`). */
const ARROW_RIGHT_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M5 12h14M12 5l7 7-7 7' } },
  ],
};

/** Immeuble — liste des logements (lucide `Building2`). */
const BUILDING_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18' } },
    { tag: 'path', attrs: { d: 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2' } },
    { tag: 'path', attrs: { d: 'M10 6h4M10 10h4M10 14h4M10 18h4' } },
  ],
};

/** Reçu — récap prix (lucide `ReceiptText`). */
const RECEIPT_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z' } },
    { tag: 'path', attrs: { d: 'M8 7h8M8 11h8M8 15h5' } },
  ],
};

/** Caddie — panier (lucide `ShoppingCart`). */
const CART_ICON: BookingIconShape = {
  paths: [
    { tag: 'circle', attrs: { cx: '8', cy: '21', r: '1' } },
    { tag: 'circle', attrs: { cx: '19', cy: '21', r: '1' } },
    { tag: 'path', attrs: { d: 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12' } },
  ],
};

/** Plus — ajouter au panier (lucide `Plus`). */
const PLUS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M5 12h14M12 5v14' } },
  ],
};

/** Étincelles — options & extras (lucide `Sparkles`). */
const SPARKLES_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M9.94 14.34 12 21l2.06-6.66L21 12l-6.94-2.34L12 3 9.94 9.66 3 12z' } },
    { tag: 'path', attrs: { d: 'M20 3v4M22 5h-4M4 17v2M5 18H3' } },
  ],
};

/** Liste cochée — étapes / progression (lucide `ListChecks`). */
const STEPS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'm3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8' } },
  ],
};

/** Personne — coordonnées voyageur (lucide `UserRound`). */
const USER_ROUND_ICON: BookingIconShape = {
  paths: [
    { tag: 'circle', attrs: { cx: '12', cy: '8', r: '5' } },
    { tag: 'path', attrs: { d: 'M20 21a8 8 0 0 0-16 0' } },
  ],
};

/** Connexion — bouton compte (lucide `LogIn`). */
const LOGIN_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4' } },
    { tag: 'path', attrs: { d: 'M10 17l5-5-5-5M15 12H3' } },
  ],
};

/** Flèche circulaire — réserver à nouveau (lucide `RotateCcw`). */
const ROTATE_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' } },
    { tag: 'path', attrs: { d: 'M3 3v5h5' } },
  ],
};

/**
 * Widget de réservation COMPLET (G1). `widgetType: null` → layout SDK vide → le SDK rend son
 * formulaire de recherche par défaut (property-first). Conserve l'id/valeur de marqueur du socle G0
 * pour ne pas casser les projets déjà persistés.
 */
const BOOKING_WIDGET: BookingWidgetDef = {
  id: BOOKING_WIDGET_TYPE,
  label: 'Widget de réservation',
  category: CATEGORY,
  icon: CALENDAR_ICON,
  widgetType: null,
};

/**
 * Micro-widgets SDK exposés en blocs GrapesJS (G2). Chaque entrée cible UN `WidgetType` réel,
 * câblé par `BaitlyWidget.buildLayoutWidget`. Les `defaultProps` reprennent ceux du `widgetRegistry`
 * (source de vérité de l'aperçu Studio) pour que le bloc déposé rende un état par défaut cohérent.
 *
 * Ordonnés selon le PARCOURS de réservation (cf. `WIDGET_CATEGORIES`) :
 * recherche → résultats & prix → panier & options → coordonnées & réservation → compte.
 *
 * NB : le conteneur `group` (17e `WidgetType`) n'est PAS exposé : c'est un agrégateur SDK qui n'a de
 * sens qu'AVEC des enfants, ce que le `componentConfig` mono-nœud (`widgetLayout[0]`) ne peut pas
 * transporter. La composition se fait nativement en GrapesJS (plusieurs blocs côte à côte), pas via un
 * `group` vide. Pour une « barre de recherche complète », utiliser le widget de réservation complet
 * (`booking-widget`, layout vide → formulaire de recherche par défaut du SDK).
 */

// ── Recherche ──

/** Recherche ville. SDK : `buildPropertyList()` (entrée property-first). */
const CITY_SEARCH_WIDGET: BookingWidgetDef = {
  id: 'booking-city-search',
  label: 'Recherche ville',
  category: CATEGORY,
  icon: SEARCH_ICON,
  widgetType: 'citySearch',
  defaultProps: { placeholder: 'Où souhaitez-vous aller ?' },
};

/** Sélecteur de dates (arrivée → départ). SDK : DatePicker + calendrier. */
const DATES_WIDGET: BookingWidgetDef = {
  id: 'booking-dates',
  label: 'Dates',
  category: CATEGORY,
  icon: CALENDAR_DAYS_ICON,
  widgetType: 'dates',
  defaultProps: { label: 'Arrivée — Départ' },
};

/** Nombre de voyageurs. SDK : `createGuestSelector`. */
const GUESTS_WIDGET: BookingWidgetDef = {
  id: 'booking-guests',
  label: 'Voyageurs',
  category: CATEGORY,
  icon: USERS_ICON,
  widgetType: 'guests',
  defaultProps: { label: 'Voyageurs' },
};

/** Filtre par type de logement. SDK : `createPropertyFilter`. */
const PROPERTY_TYPE_WIDGET: BookingWidgetDef = {
  id: 'booking-property-type',
  label: 'Type de logement',
  category: CATEGORY,
  icon: HOME_ICON,
  widgetType: 'propertyType',
  defaultProps: { label: 'Type de logement' },
};

/** Filtre additionnel (équipement, budget…). SDK : `createPropertyFilter` (même rendu que le type). */
const FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-filter',
  label: 'Filtre',
  category: CATEGORY,
  icon: SLIDERS_ICON,
  widgetType: 'filter',
  defaultProps: { label: 'Filtres' },
};

/** Sélecteur de devise. SDK : `createCurrencySelector`. */
const CURRENCY_WIDGET: BookingWidgetDef = {
  id: 'booking-currency',
  label: 'Devise',
  category: CATEGORY,
  icon: COINS_ICON,
  widgetType: 'currency',
  defaultProps: { label: 'EUR' },
};

/** Bouton de validation de la recherche. SDK : `createCTAButton`. */
const SEARCH_BUTTON_WIDGET: BookingWidgetDef = {
  id: 'booking-search-button',
  label: 'Bouton Rechercher',
  category: CATEGORY,
  icon: ARROW_RIGHT_ICON,
  widgetType: 'searchButton',
  defaultProps: { label: 'Rechercher' },
};

// ── Résultats & prix ──

/**
 * Liste des logements disponibles (résultats cliquables). SDK : `buildPropertyList(opts)`.
 * `defaultProps` repris à l'identique du `widgetRegistry` (`PROPERTY_RESULTS`) pour un rendu par
 * défaut cohérent dès le dépôt du bloc.
 */
const PROPERTY_RESULTS_WIDGET: BookingWidgetDef = {
  id: 'booking-property-results',
  label: 'Logements disponibles',
  category: CATEGORY,
  icon: BUILDING_ICON,
  widgetType: 'propertyResults',
  defaultProps: {
    mode: 'all', cardStyle: 'vertical', direction: 'column', columns: 0, horizontalScroll: false, pageSize: 6, limit: 6, fillEmpty: false,
    showImage: true, showLocation: true, showPrice: true, showBadges: false,
    // Typographie par élément (vide / 0 = hérité du thème).
    titleFont: '', titleSize: 0, titleWeight: '', titleColor: '',
    locationFont: '', locationSize: 0, locationColor: '',
    priceFont: '', priceSize: 0, priceWeight: '', priceColor: '',
  },
};

/** Récapitulatif détaillé du prix du séjour. SDK : `createPriceSummary`. */
const PRICE_SUMMARY_WIDGET: BookingWidgetDef = {
  id: 'booking-price-summary',
  label: 'Récap prix',
  category: CATEGORY,
  icon: RECEIPT_ICON,
  widgetType: 'priceSummary',
};

// ── Panier & options ──

/** Panier multi-séjours. SDK : `createCartList`. */
const CART_WIDGET: BookingWidgetDef = {
  id: 'booking-cart',
  label: 'Panier',
  category: CATEGORY,
  icon: CART_ICON,
  widgetType: 'cart',
};

/** Ajoute le séjour courant au panier. SDK : `buildAddToCart`. */
const ADD_TO_CART_WIDGET: BookingWidgetDef = {
  id: 'booking-add-to-cart',
  label: 'Ajouter au panier',
  category: CATEGORY,
  icon: PLUS_ICON,
  widgetType: 'addToCart',
  defaultProps: { label: 'Ajouter au panier' },
};

/** Services additionnels du séjour. SDK : `createAddonsPanel`. */
const ADDONS_WIDGET: BookingWidgetDef = {
  id: 'booking-addons',
  label: 'Options & extras',
  category: CATEGORY,
  icon: SPARKLES_ICON,
  widgetType: 'addons',
};

// ── Coordonnées & réservation ──

/** Indicateur de progression du parcours. SDK : `createStepper`. */
const STEPPER_WIDGET: BookingWidgetDef = {
  id: 'booking-stepper',
  label: 'Étapes (progression)',
  category: CATEGORY,
  icon: STEPS_ICON,
  widgetType: 'stepper',
};

/** Formulaire de coordonnées voyageur → paiement. SDK : `createGuestForm`. */
const GUEST_FORM_WIDGET: BookingWidgetDef = {
  id: 'booking-guest-form',
  label: 'Coordonnées voyageur',
  category: CATEGORY,
  icon: USER_ROUND_ICON,
  widgetType: 'guestForm',
};

// ── Compte ──

/** Bouton de connexion au compte voyageur. SDK : `buildAccountButton` (null si org inconnue). */
const ACCOUNT_WIDGET: BookingWidgetDef = {
  id: 'booking-account',
  label: 'Connexion / compte',
  category: CATEGORY,
  icon: LOGIN_ICON,
  widgetType: 'account',
  defaultProps: { label: 'Se connecter' },
};

/** Re-booking 1-clic pour le voyageur connecté. SDK : `createRebookStrip` (null si org inconnue). */
const REBOOK_WIDGET: BookingWidgetDef = {
  id: 'booking-rebook',
  label: 'Réserver à nouveau',
  category: CATEGORY,
  icon: ROTATE_ICON,
  widgetType: 'rebook',
};

/**
 * Registre des widgets de réservation montables dans GrapesJS.
 * Widget complet (G0/G1) + les 16 micro-widgets SDK (G2), ordonnés par étape du parcours.
 */
export const BOOKING_WIDGET_DEFS: BookingWidgetDef[] = [
  BOOKING_WIDGET,
  // Recherche
  CITY_SEARCH_WIDGET,
  DATES_WIDGET,
  GUESTS_WIDGET,
  PROPERTY_TYPE_WIDGET,
  FILTER_WIDGET,
  CURRENCY_WIDGET,
  SEARCH_BUTTON_WIDGET,
  // Résultats & prix
  PROPERTY_RESULTS_WIDGET,
  PRICE_SUMMARY_WIDGET,
  // Panier & options
  CART_WIDGET,
  ADD_TO_CART_WIDGET,
  ADDONS_WIDGET,
  // Coordonnées & réservation
  STEPPER_WIDGET,
  GUEST_FORM_WIDGET,
  // Compte
  ACCOUNT_WIDGET,
  REBOOK_WIDGET,
];

/**
 * Valeur de marqueur (`data-clenzy-widget`) pour une def : l'id du composant. Le widget complet
 * historique garde sa valeur dédiée (`booking`) pour rester rétro-compatible avec le projet G0.
 */
export function attrValueOf(def: BookingWidgetDef): string {
  return def.id === BOOKING_WIDGET_TYPE ? BOOKING_WIDGET_ATTR_VALUE : def.id;
}
