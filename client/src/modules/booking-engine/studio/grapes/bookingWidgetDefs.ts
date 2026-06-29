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
  | 'propertySummary'
  | 'amenities'
  // Avis (preuve sociale)
  | 'reviews'
  | 'rating'
  // Panier
  | 'cart'
  | 'addToCart'
  | 'addons'
  // Coordonnées & réservation
  | 'stepper'
  | 'guestForm'
  | 'inquiryForm'
  | 'checkoutButton'
  | 'confirmation'
  // Compte
  | 'account'
  | 'rebook'
  // Conteneur
  | 'group';

/** Props d'un micro-widget (valeurs scalaires sérialisables). */
export type WidgetProps = Record<string, string | number | boolean>;

/**
 * Spécification d'un trait de config PAR INSTANCE (R2b). Mappé en trait GrapesJS `changeProp` par
 * `registerBookingComponents`, sérialisé dans l'attribut JSON `data-clenzy-props` du marqueur (lu par
 * l'aperçu éditeur ET par l'hydratation runtime `mountPrimitive`).
 */
export interface BookingTrait {
  /** Clé de la prop (présente dans `defaultProps`). */
  name: string;
  /** Type de contrôle GrapesJS (panneau Réglages). */
  type: 'text' | 'number' | 'checkbox' | 'select' | 'color';
  /** Libellé affiché. */
  label: string;
  /** Options (type `select` uniquement). */
  options?: { id: string; name: string }[];
}

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
  /** Description courte (affichée sous le titre dans la palette, façon ancien Studio). */
  description?: string;
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
  /** Traits de config par instance (R2b) — exposés dans le panneau Réglages GrapesJS. */
  traits?: BookingTrait[];
}

/** Attribut-marqueur émis à l'export (ancre d'hydratation SDK/SSR). Valeur = `BookingWidgetDef.id`. */
export const BOOKING_WIDGET_ATTR = 'data-clenzy-widget';

/** Catégories du BlockManager (parité ancien Studio `WIDGET_CATEGORIES`). */
const CAT_SEARCH = 'Recherche';
const CAT_RESULTS = 'Résultats & prix';
const CAT_CART = 'Panier & options';
const CAT_CHECKOUT = 'Coordonnées & réservation';
const CAT_ACCOUNT = 'Compte';

/* ── Icônes SVG statiques (alignées sur lucide-react, mêmes glyphes que `widgetRegistry`) ──
 * Chaque icône est un DOM 100 % statique (aucun innerHTML) construit par `bookingComponents.buildIcon`. */

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
 * Micro-widgets SDK exposés en blocs GrapesJS. Chaque entrée cible UN `WidgetType` réel,
 * câblé par `BaitlyWidget.buildLayoutWidget`. Les `defaultProps` reprennent ceux du `widgetRegistry`
 * (source de vérité de l'aperçu Studio) pour que le bloc déposé rende un état par défaut cohérent.
 *
 * Ordonnés selon le PARCOURS de réservation (cf. `WIDGET_CATEGORIES`) :
 * recherche → résultats & prix → panier & options → coordonnées & réservation → compte.
 *
 * NB : le conteneur `group` (17e `WidgetType`) n'est PAS exposé : c'est un agrégateur SDK qui n'a de
 * sens qu'AVEC des enfants, ce que le `componentConfig` mono-nœud (`widgetLayout[0]`) ne peut pas
 * transporter. La composition se fait nativement en GrapesJS (plusieurs blocs côte à côte). La barre de
 * recherche du parcours est rendue par la primitive `search` du SDK (marqueur `data-clenzy-widget="search"`),
 * PAS par un widget « tout-en-un » (l'ancien widget monolithique a été supprimé).
 */

// ── Recherche ──

/** Recherche ville. SDK : champ input de destination (alimente `state.destination`). */
const CITY_SEARCH_WIDGET: BookingWidgetDef = {
  id: 'booking-city-search',
  label: 'Recherche ville',
  description: 'Champ destination / ville.',
  category: CAT_SEARCH,
  icon: SEARCH_ICON,
  widgetType: 'citySearch',
  defaultProps: { placeholder: 'Où souhaitez-vous aller ?' },
};

/** Sélecteur de dates (arrivée → départ). SDK : DatePicker + calendrier. */
const DATES_WIDGET: BookingWidgetDef = {
  id: 'booking-dates',
  label: 'Dates',
  description: 'Sélecteur de dates (arrivée → départ).',
  category: CAT_SEARCH,
  icon: CALENDAR_DAYS_ICON,
  widgetType: 'dates',
  defaultProps: { label: 'Arrivée — Départ' },
};

/** Nombre de voyageurs. SDK : `createGuestSelector`. */
const GUESTS_WIDGET: BookingWidgetDef = {
  id: 'booking-guests',
  label: 'Voyageurs',
  description: 'Nombre de voyageurs (adultes / enfants).',
  category: CAT_SEARCH,
  icon: USERS_ICON,
  widgetType: 'guests',
  defaultProps: { label: 'Voyageurs' },
};

/** Filtre par type de logement. SDK : `createPropertyFilter`. */
const PROPERTY_TYPE_WIDGET: BookingWidgetDef = {
  id: 'booking-property-type',
  label: 'Type de logement',
  description: 'Filtre par type (appartement, villa, riad…).',
  category: CAT_SEARCH,
  icon: HOME_ICON,
  widgetType: 'propertyType',
  defaultProps: { label: 'Type de logement' },
};

/** Filtre additionnel (équipement, budget…). SDK : `createPropertyFilter` (même rendu que le type). */
const FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-filter',
  label: 'Filtre',
  description: 'Filtre additionnel (équipement, budget…).',
  category: CAT_SEARCH,
  icon: SLIDERS_ICON,
  widgetType: 'filter',
  defaultProps: { label: 'Filtres' },
};

/** Sélecteur de devise. SDK : `createCurrencySelector`. */
const CURRENCY_WIDGET: BookingWidgetDef = {
  id: 'booking-currency',
  label: 'Devise',
  description: 'Sélecteur de devise.',
  category: CAT_SEARCH,
  icon: COINS_ICON,
  widgetType: 'currency',
  defaultProps: { label: 'EUR' },
};

/** Bouton de validation de la recherche. SDK : `createCTAButton`. */
const SEARCH_BUTTON_WIDGET: BookingWidgetDef = {
  id: 'booking-search-button',
  label: 'Bouton Rechercher',
  description: 'Bouton de validation de la recherche.',
  category: CAT_SEARCH,
  icon: ARROW_RIGHT_ICON,
  widgetType: 'searchButton',
  defaultProps: { label: 'Rechercher' },
};

// ── Résultats & prix ──

/**
 * Traits de config par instance de `propertyResults` (R2b) — parité avec l'ex-`WidgetComposer` : ce sont
 * les seules props réellement consommées par le rendu (cf. `BaitlyWidget.buildLayoutWidget` cas
 * `propertyResults` + `mountPrimitive.buildPropertyListFromProps`). Disposition + toggles + typographie.
 */
const PROPERTY_RESULTS_TRAITS: BookingTrait[] = [
  { name: 'mode', type: 'select', label: 'Affichage', options: [{ id: 'all', name: 'Tous' }, { id: 'limited', name: 'Limité' }, { id: 'paginated', name: 'Paginé' }] },
  { name: 'limit', type: 'number', label: 'Limite (mode limité)' },
  { name: 'pageSize', type: 'number', label: 'Par page (mode paginé)' },
  { name: 'cardStyle', type: 'select', label: 'Style de carte', options: [{ id: 'vertical', name: 'Vertical' }, { id: 'horizontal', name: 'Horizontal' }, { id: 'overlay', name: 'Superposé' }, { id: 'minimal', name: 'Minimal' }] },
  { name: 'direction', type: 'select', label: 'Direction', options: [{ id: 'column', name: 'Colonne' }, { id: 'row', name: 'Ligne' }] },
  { name: 'columns', type: 'number', label: 'Colonnes (0 = auto)' },
  { name: 'horizontalScroll', type: 'checkbox', label: 'Défilement horizontal' },
  { name: 'fillEmpty', type: 'checkbox', label: 'Remplir les cases vides' },
  { name: 'showImage', type: 'checkbox', label: 'Afficher l’image' },
  { name: 'showLocation', type: 'checkbox', label: 'Afficher le lieu' },
  { name: 'showPrice', type: 'checkbox', label: 'Afficher le prix' },
  { name: 'showBadges', type: 'checkbox', label: 'Afficher les badges' },
  // Typographie par élément (vide / 0 = hérité du thème).
  { name: 'titleFont', type: 'text', label: 'Police titre' },
  { name: 'titleSize', type: 'number', label: 'Taille titre' },
  { name: 'titleWeight', type: 'text', label: 'Graisse titre' },
  { name: 'titleColor', type: 'color', label: 'Couleur titre' },
  { name: 'locationFont', type: 'text', label: 'Police lieu' },
  { name: 'locationSize', type: 'number', label: 'Taille lieu' },
  { name: 'locationColor', type: 'color', label: 'Couleur lieu' },
  { name: 'priceFont', type: 'text', label: 'Police prix' },
  { name: 'priceSize', type: 'number', label: 'Taille prix' },
  { name: 'priceWeight', type: 'text', label: 'Graisse prix' },
  { name: 'priceColor', type: 'color', label: 'Couleur prix' },
];

/**
 * Liste des logements disponibles (résultats cliquables). SDK : `buildPropertyList(opts)`.
 * `defaultProps` repris à l'identique du `widgetRegistry` (`PROPERTY_RESULTS`) pour un rendu par
 * défaut cohérent dès le dépôt du bloc. `traits` = config par instance (R2b).
 */
const PROPERTY_RESULTS_WIDGET: BookingWidgetDef = {
  id: 'booking-property-results',
  label: 'Logements disponibles',
  description: 'Liste des logements disponibles (résultats de recherche, cliquables).',
  category: CAT_RESULTS,
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
  traits: PROPERTY_RESULTS_TRAITS,
};

/** Récapitulatif détaillé du prix du séjour. SDK : `createPriceSummary`. */
const PRICE_SUMMARY_WIDGET: BookingWidgetDef = {
  id: 'booking-price-summary',
  label: 'Récap prix',
  description: 'Récapitulatif détaillé du prix du séjour.',
  category: CAT_RESULTS,
  icon: RECEIPT_ICON,
  widgetType: 'priceSummary',
};

// ── Panier & options ──

/** Panier multi-séjours. SDK : `createCartList`. */
const CART_WIDGET: BookingWidgetDef = {
  id: 'booking-cart',
  label: 'Panier',
  description: 'Panier multi-séjours : liste des séjours ajoutés + total + validation.',
  category: CAT_CART,
  icon: CART_ICON,
  widgetType: 'cart',
};

/** Ajoute le séjour courant au panier. SDK : `buildAddToCart`. */
const ADD_TO_CART_WIDGET: BookingWidgetDef = {
  id: 'booking-add-to-cart',
  label: 'Ajouter au panier',
  description: 'Ajoute le séjour courant au panier (multi-séjours).',
  category: CAT_CART,
  icon: PLUS_ICON,
  widgetType: 'addToCart',
  defaultProps: { label: 'Ajouter au panier' },
};

/** Services additionnels du séjour. SDK : `createAddonsPanel`. */
const ADDONS_WIDGET: BookingWidgetDef = {
  id: 'booking-addons',
  label: 'Options & extras',
  description: 'Services additionnels du séjour (transfert, ménage, petit-déjeuner…).',
  category: CAT_CART,
  icon: SPARKLES_ICON,
  widgetType: 'addons',
};

// ── Coordonnées & réservation ──

/** Indicateur de progression du parcours. SDK : `createStepper`. */
const STEPPER_WIDGET: BookingWidgetDef = {
  id: 'booking-stepper',
  label: 'Étapes (progression)',
  description: 'Indicateur de progression : séjour → identité → validation → confirmation.',
  category: CAT_CHECKOUT,
  icon: STEPS_ICON,
  widgetType: 'stepper',
};

/** Formulaire de coordonnées voyageur → paiement. SDK : `createGuestForm`. */
const GUEST_FORM_WIDGET: BookingWidgetDef = {
  id: 'booking-guest-form',
  label: 'Coordonnées voyageur',
  description: 'Formulaire de contact (nom, e-mail, téléphone) → bouton de paiement.',
  category: CAT_CHECKOUT,
  icon: USER_ROUND_ICON,
  widgetType: 'guestForm',
};

/** Enveloppe — demande de devis (lucide `Mail`). */
const MAIL_ICON: BookingIconShape = {
  paths: [
    { tag: 'rect', attrs: { x: '2', y: '4', width: '20', height: '16', rx: '2' } },
    { tag: 'path', attrs: { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' } },
  ],
};

/** Demande de devis (sans paiement) : coordonnées + message → host. SDK : `createGuestForm` + submit inquiry. */
const INQUIRY_FORM_WIDGET: BookingWidgetDef = {
  id: 'booking-inquiry-form',
  label: 'Demande de devis',
  description: 'Sans paiement : coordonnées + message → la demande est envoyée au host.',
  category: CAT_CHECKOUT,
  icon: MAIL_ICON,
  widgetType: 'inquiryForm',
};

// ── Compte ──

/** Bouton de connexion au compte voyageur. SDK : `buildAccountButton` (null si org inconnue). */
const ACCOUNT_WIDGET: BookingWidgetDef = {
  id: 'booking-account',
  label: 'Connexion / compte',
  description: 'Bouton de connexion au compte voyageur (favoris, re-booking).',
  category: CAT_ACCOUNT,
  icon: LOGIN_ICON,
  widgetType: 'account',
  defaultProps: { label: 'Se connecter' },
};

/** Re-booking 1-clic pour le voyageur connecté. SDK : `createRebookStrip` (null si org inconnue). */
const REBOOK_WIDGET: BookingWidgetDef = {
  id: 'booking-rebook',
  label: 'Réserver à nouveau',
  description: 'Re-booking 1-clic pour le voyageur connecté (séjours passés).',
  category: CAT_ACCOUNT,
  icon: ROTATE_ICON,
  widgetType: 'rebook',
};

/* ── Icônes des widgets ajoutés (galerie de réservation) ── */

/** Lit double — détail du logement (lucide `BedDouble`). */
const BED_DOUBLE_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8' } },
    { tag: 'path', attrs: { d: 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4' } },
    { tag: 'path', attrs: { d: 'M12 4v6' } },
    { tag: 'path', attrs: { d: 'M2 18h20' } },
  ],
};

/** Ondes Wi-Fi — équipements (lucide `Wifi`). */
const WIFI_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M12 20h.01' } },
    { tag: 'path', attrs: { d: 'M2 8.82a15 15 0 0 1 20 0' } },
    { tag: 'path', attrs: { d: 'M5 12.859a10 10 0 0 1 14 0' } },
    { tag: 'path', attrs: { d: 'M8.5 16.429a5 5 0 0 1 7 0' } },
  ],
};

/** Carte bancaire — bouton de paiement (lucide `CreditCard`). */
const CREDIT_CARD_ICON: BookingIconShape = {
  paths: [
    { tag: 'rect', attrs: { x: '2', y: '5', width: '20', height: '14', rx: '2' } },
    { tag: 'path', attrs: { d: 'M2 10h20' } },
  ],
};

/** Cercle coché — confirmation (lucide `CircleCheck`). */
const CHECK_CIRCLE_ICON: BookingIconShape = {
  paths: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
    { tag: 'path', attrs: { d: 'm9 12 2 2 4-4' } },
  ],
};

/* ── Defs des widgets ajoutés ── */

/** Détail du logement sélectionné. SDK : `createPropertySummary`. */
const PROPERTY_SUMMARY_WIDGET: BookingWidgetDef = {
  id: 'booking-property-summary',
  label: 'Détail du logement',
  description: 'Photo, nom, lieu et prix du logement sélectionné.',
  category: CAT_RESULTS,
  icon: BED_DOUBLE_ICON,
  widgetType: 'propertySummary',
};

/** Équipements du logement sélectionné. SDK : `createAmenitiesList`. */
const AMENITIES_WIDGET: BookingWidgetDef = {
  id: 'booking-amenities',
  label: 'Équipements',
  description: 'Liste des équipements du logement sélectionné.',
  category: CAT_RESULTS,
  icon: WIFI_ICON,
  widgetType: 'amenities',
};

/** Bouton de paiement isolé → checkout Stripe. SDK : `buildCheckoutButton`. */
const CHECKOUT_BUTTON_WIDGET: BookingWidgetDef = {
  id: 'booking-checkout-button',
  label: 'Bouton de paiement',
  description: 'Lance le paiement (Stripe) du séjour sélectionné.',
  category: CAT_CHECKOUT,
  icon: CREDIT_CARD_ICON,
  widgetType: 'checkoutButton',
};

/** Écran de confirmation post-réservation. SDK : `createConfirmationCard` / `buildConfirmation`. */
const CONFIRMATION_WIDGET: BookingWidgetDef = {
  id: 'booking-confirmation',
  label: 'Confirmation',
  description: 'Écran de remerciement après réservation (référence + récapitulatif).',
  category: CAT_CHECKOUT,
  icon: CHECK_CIRCLE_ICON,
  widgetType: 'confirmation',
};

/* ── Critères de filtre AUTONOMES (widgets indépendants, déposables/déplaçables en DnD, ≠ bloc « Filtre »
 *    groupé). Chacun écrit directement un critère de `state.filters` (cf. `mountPrimitive`). ── */
const PRICE_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-price', label: 'Prix', description: 'Fourchette de prix / nuit (min – max).',
  category: CAT_SEARCH, icon: COINS_ICON, widgetType: 'filter',
};
const BEDROOMS_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-bedrooms', label: 'Chambres', description: 'Nombre minimum de chambres.',
  category: CAT_SEARCH, icon: BED_DOUBLE_ICON, widgetType: 'filter',
};
const BATHROOMS_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-bathrooms', label: 'Salles de bain', description: 'Nombre minimum de salles de bain.',
  category: CAT_SEARCH, icon: HOME_ICON, widgetType: 'filter',
};
const CAPACITY_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-capacity', label: 'Capacité', description: 'Nombre minimum de voyageurs accueillis.',
  category: CAT_SEARCH, icon: USERS_ICON, widgetType: 'filter',
};
const AMENITIES_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-amenities-filter', label: 'Équipements (filtre)', description: 'Filtre multi-équipements (Wifi, piscine…).',
  category: CAT_SEARCH, icon: WIFI_ICON, widgetType: 'filter',
};

/** Étoile — badge de note (lucide `Star`). */
const STAR_ICON: BookingIconShape = {
  paths: [{ tag: 'polygon', attrs: { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26' } }],
};

/** Bulle de citation — section d'avis (lucide `MessageSquare`). */
const REVIEWS_ICON: BookingIconShape = {
  paths: [{ tag: 'path', attrs: { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' } }],
};

/** Section d'avis publics (résumé note + distribution + liste). SDK : `createReviewsList`. */
const REVIEWS_WIDGET: BookingWidgetDef = {
  id: 'booking-reviews',
  label: 'Avis voyageurs',
  description: 'Note moyenne, distribution et liste des avis publics.',
  category: CAT_RESULTS,
  icon: REVIEWS_ICON,
  widgetType: 'reviews',
};

/** Badge note compact (★ 4,7 · N avis) du logement sélectionné. SDK : `createRatingBadge`. */
const RATING_WIDGET: BookingWidgetDef = {
  id: 'booking-rating',
  label: 'Note (badge)',
  description: 'Note moyenne et nombre d’avis, en ligne compacte.',
  category: CAT_RESULTS,
  icon: STAR_ICON,
  widgetType: 'rating',
};

/**
 * Registre des widgets de réservation montables dans GrapesJS : les micro-widgets SDK, ordonnés par
 * étape du parcours. Il n'y a PLUS de widget « tout-en-un » (l'ancien monolithe a été supprimé) — la
 * barre de recherche est la primitive `search` du SDK.
 */
export const BOOKING_WIDGET_DEFS: BookingWidgetDef[] = [
  // Recherche
  CITY_SEARCH_WIDGET,
  DATES_WIDGET,
  GUESTS_WIDGET,
  PROPERTY_TYPE_WIDGET,
  FILTER_WIDGET,
  PRICE_FILTER_WIDGET,
  BEDROOMS_FILTER_WIDGET,
  BATHROOMS_FILTER_WIDGET,
  CAPACITY_FILTER_WIDGET,
  AMENITIES_FILTER_WIDGET,
  CURRENCY_WIDGET,
  SEARCH_BUTTON_WIDGET,
  // Résultats & prix
  PROPERTY_RESULTS_WIDGET,
  PROPERTY_SUMMARY_WIDGET,
  AMENITIES_WIDGET,
  REVIEWS_WIDGET,
  RATING_WIDGET,
  PRICE_SUMMARY_WIDGET,
  // Panier & options
  CART_WIDGET,
  ADD_TO_CART_WIDGET,
  ADDONS_WIDGET,
  // Coordonnées & réservation
  STEPPER_WIDGET,
  GUEST_FORM_WIDGET,
  INQUIRY_FORM_WIDGET,
  CHECKOUT_BUTTON_WIDGET,
  CONFIRMATION_WIDGET,
  // Compte
  ACCOUNT_WIDGET,
  REBOOK_WIDGET,
];

/** Valeur de marqueur (`data-clenzy-widget`) pour une def = l'id du composant. */
export function attrValueOf(def: BookingWidgetDef): string {
  return def.id;
}
