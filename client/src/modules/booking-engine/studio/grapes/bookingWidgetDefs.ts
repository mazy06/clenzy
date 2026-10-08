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
  /** Cle du libelle affiche. */
  labelKey: string;
  /** Options (type `select` uniquement) — le nom est une cle. */
  options?: { id: string; nameKey: string }[];
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

/** Géométrie d'une icône SVG (glyphe Reicon, en aplats) sérialisable en DOM sûr (aucun innerHTML). */
export interface BookingIconShape {
  /** Nœuds enfants du `<svg>` (path, circle, ellipse…), remplis en `currentColor`. */
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
  /** Cle du libelle affiche (bloc + nom de calque). */
  labelKey: string;
  /** Cle de la description courte (sous le titre dans la palette). */
  descriptionKey?: string;
  /** Cle de la categorie du BlockManager (regroupement de la palette). */
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
const CAT_SEARCH = 'studioBlocks.categories.search';
const CAT_RESULTS = 'studioBlocks.categories.results';
const CAT_CART = 'studioBlocks.categories.cart';
const CAT_CHECKOUT = 'studioBlocks.categories.checkout';
const CAT_ACCOUNT = 'studioBlocks.categories.account';

/* ── Icônes SVG statiques (glyphes Reicon, mêmes graisses que le reste de l'app) ──
 * Chaque icône est un DOM 100 % statique (aucun innerHTML) construit par `bookingComponents.buildIcon`.
 * Géométrie en APLATS (fill = currentColor), duotone quand Reicon le fournit : les
 * sous-tracés `opacity=".5"` forment le second ton. */

/** Loupe — recherche ville (Reicon `search`). */
const SEARCH_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { 'fill-rule': 'evenodd', d: 'M11.5 2.75a8.75 8.75 0 1 0 0 17.5a8.75 8.75 0 0 0 0-17.5M1.25 11.5c0-5.66 4.59-10.25 10.25-10.25S21.75 5.84 21.75 11.5c0 2.56-.939 4.902-2.491 6.698l3.271 3.272a.75.75 0 1 1-1.06 1.06l-3.272-3.271A10.2 10.2 0 0 1 11.5 21.75c-5.66 0-10.25-4.59-10.25-10.25', 'clip-rule': 'evenodd' } },
  ],
};

/** Calendrier — sélecteur de dates (Reicon `calendar2-duotone`). */
const CALENDAR_DAYS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M6.94 2c.416 0 .753.324.753.724v1.46c.668-.012 1.417-.012 2.26-.012h4.015c.842 0 1.591 0 2.259.013v-1.46c0-.4.337-.725.753-.725s.753.324.753.724V4.25c1.445.111 2.394.384 3.09 1.055c.698.67.982 1.582 1.097 2.972L22 9H2v-.724c.116-1.39.4-2.302 1.097-2.972s1.645-.944 3.09-1.055V2.724c0-.4.337-.724.753-.724' } },
    { tag: 'path', attrs: { d: 'M22 14v-2c0-.839-.004-2.335-.017-3H2.01c-.013.665-.01 2.161-.01 3v2c0 3.771 0 5.657 1.172 6.828S6.228 22 10 22h4c3.77 0 5.656 0 6.828-1.172S22 17.772 22 14', opacity: '.5' } },
  ],
};

/** Groupe de personnes — voyageurs (Reicon `users-duotone`). */
const USERS_ICON: BookingIconShape = {
  paths: [
    { tag: 'circle', attrs: { cx: '15', cy: '6', r: '3', opacity: '.4' } },
    { tag: 'ellipse', attrs: { cx: '16', cy: '17', opacity: '.4', rx: '5', ry: '3' } },
    { tag: 'circle', attrs: { cx: '9.001', cy: '6', r: '4' } },
    { tag: 'ellipse', attrs: { cx: '9.001', cy: '17.001', rx: '7', ry: '4' } },
  ],
};

/** Maison — type de logement (Reicon `home-duotone`). */
const HOME_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M2 12.204c0-2.289 0-3.433.52-4.381c.518-.949 1.467-1.537 3.364-2.715l2-1.241C9.889 2.622 10.892 2 12 2s2.11.622 4.116 1.867l2 1.241c1.897 1.178 2.846 1.766 3.365 2.715S22 9.915 22 12.203v1.522c0 3.9 0 5.851-1.172 7.063S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.212S2 17.626 2 13.725z', opacity: '.5' } },
    { tag: 'path', attrs: { d: 'M9 17.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5z' } },
  ],
};

/** Curseurs — filtre (Reicon `tuning2-duotone`). */
const SLIDERS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M9.25 14a3 3 0 1 1 0 6a3 3 0 0 1 0-6m5-10a3 3 0 1 0 0 6a3 3 0 0 0 0-6' } },
    { tag: 'path', attrs: { d: 'M17.166 7.709a3 3 0 0 0-.021-1.5h4.605a.75.75 0 0 1 0 1.5zm-5.81-1.5a3 3 0 0 0-.022 1.5H1.75a.75.75 0 0 1 0-1.5zm-5 10H1.75a.75.75 0 0 0 0 1.5h4.584a3 3 0 0 1 .022-1.5m5.81 1.5h9.584a.75.75 0 0 0 0-1.5h-9.605a3 3 0 0 1 .02 1.5', opacity: '.5' } },
  ],
};

/** Billets — devise (Reicon `money-stack-duotone`). */
const COINS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M14.25 19h1.5c2.317-.005 3.558-.062 4.472-.674a4 4 0 0 0 1.104-1.103C22 16.213 22 14.809 22 12s0-4.213-.674-5.222a4 4 0 0 0-1.104-1.103c-.915-.612-2.155-.669-4.472-.674h-1.5V9H15a3 3 0 1 1 0 6h-.75zm-4.5 0v-4H9a3 3 0 1 1 0-6h.75V5.001h-1.5c-2.317.005-3.557.062-4.472.674a4 4 0 0 0-1.104 1.103C2 7.787 2 9.192 2 12c0 2.81 0 4.214.674 5.223a4 4 0 0 0 1.104 1.103c.915.612 2.155.669 4.472.674z' } },
    { tag: 'path', attrs: { d: 'M9.75 19h4.5V5h-4.5z', opacity: '.5' } },
  ],
};

/** Flèche droite — bouton Rechercher (Reicon `arrow-right-duotone`). */
const ARROW_RIGHT_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { 'fill-rule': 'evenodd', d: 'M3.25 12a.75.75 0 0 1 .75-.75h9.25v1.5H4a.75.75 0 0 1-.75-.75', 'clip-rule': 'evenodd', opacity: '.5' } },
    { tag: 'path', attrs: { d: 'M13.25 12.75V18a.75.75 0 0 0 1.28.53l6-6a.75.75 0 0 0 0-1.06l-6-6a.75.75 0 0 0-1.28.53z' } },
  ],
};

/** Immeubles — liste des logements (Reicon `buildings-duotone`). */
const BUILDING_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { 'fill-rule': 'evenodd', d: 'M7 5h4c1.886 0 2.828 0 3.414.586S15 7.114 15 9v12.25h7a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1 0-1.5h1V9c0-1.886 0-2.828.586-3.414S5.114 5 7 5M5.25 8A.75.75 0 0 1 6 7.25h6a.75.75 0 0 1 0 1.5H6A.75.75 0 0 1 5.25 8m0 3a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75m0 3a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75M9 18.25a.75.75 0 0 1 .75.75v2.25h-1.5V19a.75.75 0 0 1 .75-.75', 'clip-rule': 'evenodd' } },
    { tag: 'path', attrs: { d: 'M15 2h2c1.886 0 2.828 0 3.414.586S21 4.114 21 6v15.25h-6V9c0-1.886 0-2.828-.586-3.414C13.842 5.013 12.928 5 11.126 5V3.5c.084-.387.225-.68.46-.914C12.17 2 13.114 2 15 2', opacity: '.5' } },
  ],
};

/** Reçu — récap prix (Reicon `bill-list-duotone`). */
const RECEIPT_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M7.245 2h9.51c1.159 0 1.738 0 2.206.163a3.05 3.05 0 0 1 1.881 1.936C21 4.581 21 5.177 21 6.37v14.004c0 .858-.985 1.314-1.608.744a.946.946 0 0 0-1.284 0l-.483.442a1.657 1.657 0 0 1-2.25 0a1.657 1.657 0 0 0-2.25 0a1.657 1.657 0 0 1-2.25 0a1.657 1.657 0 0 0-2.25 0a1.657 1.657 0 0 1-2.25 0l-.483-.442a.946.946 0 0 0-1.284 0c-.623.57-1.608.114-1.608-.744V6.37c0-1.193 0-1.79.158-2.27c.3-.913.995-1.629 1.881-1.937C5.507 2 6.086 2 7.245 2', opacity: '.5' } },
    { tag: 'path', attrs: { d: 'M7 6.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5zm3.5 0a.75.75 0 0 0 0 1.5H17a.75.75 0 0 0 0-1.5zM7 10.25a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5zm3.5 0a.75.75 0 0 0 0 1.5H17a.75.75 0 0 0 0-1.5zM7 13.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5zm3.5 0a.75.75 0 0 0 0 1.5H17a.75.75 0 0 0 0-1.5z' } },
  ],
};

/** Caddie — panier (Reicon `cart-duotone`). */
const CART_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M10.023 2a1.75 1.75 0 0 0 0 3.5h4a1.75 1.75 0 1 0 0-3.5zM3.887 16.205C3.029 12.773 2.6 11.058 3.5 9.904S6.17 8.75 9.708 8.75h4.63c3.538 0 5.306 0 6.207 1.154s.472 2.87-.386 6.301c-.546 2.183-.818 3.274-1.632 3.91c-.814.635-1.939.635-4.189.635h-4.63c-2.25 0-3.375 0-4.189-.635c-.814-.636-1.087-1.727-1.632-3.91', opacity: '.5' } },
    { tag: 'path', attrs: { d: 'M15.604 4.502a1.74 1.74 0 0 0 .002-1.501c.683.005 1.216.036 1.691.222a3.25 3.25 0 0 1 1.426 1.09c.367.494.54 1.127.777 1.999l.046.17l.513 2.963c-.409-.282-.936-.45-1.618-.55l-.36-2.087c-.285-1.04-.388-1.367-.562-1.601a1.75 1.75 0 0 0-.768-.587c-.22-.086-.485-.11-1.147-.118M8.441 3.001a1.74 1.74 0 0 0 .002 1.501c-.662.007-.927.032-1.147.118a1.75 1.75 0 0 0-.768.587c-.174.234-.277.561-.561 1.6l-.361 2.089c-.682.1-1.209.267-1.618.548l.513-2.962l.046-.17c.237-.872.41-1.505.777-2A3.25 3.25 0 0 1 6.75 3.224c.475-.186 1.008-.217 1.691-.222' } },
  ],
};

/** Plus — ajouter au panier (Reicon `plus`). */
const PLUS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M11.25 20a.75.75 0 0 0 1.5 0v-7.25H20a.75.75 0 0 0 0-1.5h-7.25V4a.75.75 0 0 0-1.5 0v7.25H4a.75.75 0 0 0 0 1.5h7.25z' } },
  ],
};

/** Étincelles — options & extras (Reicon `stars-duotone`). */
const SPARKLES_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { d: 'M7.453 2.713c.375-.95 1.72-.95 2.094 0l1.162 2.944c.114.29.344.52.634.634l2.944 1.162c.95.375.95 1.72 0 2.094l-2.944 1.162c-.29.114-.52.344-.634.634l-1.162 2.944c-.375.95-1.72.95-2.094 0L6.29 11.343a1.13 1.13 0 0 0-.634-.634L2.713 9.547c-.95-.375-.95-1.72 0-2.094L5.657 6.29c.29-.114.52-.344.634-.634z' } },
    { tag: 'path', attrs: { d: 'M16.925 13.392a.619.619 0 0 1 1.15 0l.901 2.283a.62.62 0 0 0 .349.349l2.283.9a.619.619 0 0 1 0 1.152l-2.283.9a.62.62 0 0 0-.349.349l-.9 2.283a.619.619 0 0 1-1.152 0l-.9-2.283a.62.62 0 0 0-.349-.349l-2.283-.9a.619.619 0 0 1 0-1.152l2.283-.9a.62.62 0 0 0 .349-.349z', opacity: '.5' } },
  ],
};

/** Liste cochée — étapes / progression (Reicon `list-check-duotone`). */
const STEPS_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { 'fill-rule': 'evenodd', d: 'M2 5.75A.75.75 0 0 1 2.75 5h18a.75.75 0 0 1 0 1.5h-18A.75.75 0 0 1 2 5.75m0 4A.75.75 0 0 1 2.75 9h18a.75.75 0 0 1 0 1.5h-18A.75.75 0 0 1 2 9.75m0 4a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75m0 4a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75', 'clip-rule': 'evenodd', opacity: '.5' } },
    { tag: 'path', attrs: { d: 'M20.211 12.659a.75.75 0 0 1 .13 1.052l-3.9 5a.75.75 0 0 1-1.165.021l-2.1-2.5a.75.75 0 0 1 1.148-.964l1.504 1.79l3.33-4.27a.75.75 0 0 1 1.053-.13' } },
  ],
};

/** Personne — coordonnées voyageur (Reicon `user-duotone`). */
const USER_ROUND_ICON: BookingIconShape = {
  paths: [
    { tag: 'circle', attrs: { cx: '12', cy: '6', r: '4' } },
    { tag: 'path', attrs: { d: 'M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5', opacity: '.5' } },
  ],
};

/** Connexion — bouton compte (Reicon `login-duotone`). */
const LOGIN_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { 'fill-rule': 'evenodd', d: 'M10.47 8.47a.75.75 0 0 0 0 1.06l1.72 1.72H4a.75.75 0 0 0 0 1.5h8.19l-1.72 1.72a.75.75 0 1 0 1.06 1.06l3-3a.75.75 0 0 0 0-1.06l-3-3a.75.75 0 0 0-1.06 0', 'clip-rule': 'evenodd' } },
    { tag: 'path', attrs: { d: 'M12 20a8 8 0 1 0 0-16z', opacity: '.5' } },
  ],
};

/** Flèche circulaire — réserver à nouveau (Reicon `rotate-left`). */
const ROTATE_ICON: BookingIconShape = {
  paths: [
    { tag: 'path', attrs: { stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M9.11 5.08c.87-.26 1.83-.43 2.89-.43c4.79 0 8.67 3.88 8.67 8.67s-3.88 8.67-8.67 8.67s-8.67-3.88-8.67-8.67c0-1.78.54-3.44 1.46-4.82m3.08-3.18L10.76 2M7.87 5.32l3.37 2.46' } },
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
  labelKey: 'studioBlocks.booking-city-search.label',
  descriptionKey: 'studioBlocks.booking-city-search.description',
  category: CAT_SEARCH,
  icon: SEARCH_ICON,
  widgetType: 'citySearch',
  defaultProps: { placeholder: 'Où souhaitez-vous aller ?' },
};

/** Sélecteur de dates (arrivée → départ). SDK : DatePicker + calendrier. */
const DATES_WIDGET: BookingWidgetDef = {
  id: 'booking-dates',
  labelKey: 'studioBlocks.booking-dates.label',
  descriptionKey: 'studioBlocks.booking-dates.description',
  category: CAT_SEARCH,
  icon: CALENDAR_DAYS_ICON,
  widgetType: 'dates',
  defaultProps: { label: 'Arrivée — Départ' },
};

/** Nombre de voyageurs. SDK : `createGuestSelector`. */
const GUESTS_WIDGET: BookingWidgetDef = {
  id: 'booking-guests',
  labelKey: 'studioBlocks.booking-guests.label',
  descriptionKey: 'studioBlocks.booking-guests.description',
  category: CAT_SEARCH,
  icon: USERS_ICON,
  widgetType: 'guests',
  defaultProps: { label: 'Voyageurs' },
};

/** Filtre par type de logement. SDK : `createPropertyFilter`. */
const PROPERTY_TYPE_WIDGET: BookingWidgetDef = {
  id: 'booking-property-type',
  labelKey: 'studioBlocks.booking-property-type.label',
  descriptionKey: 'studioBlocks.booking-property-type.description',
  category: CAT_SEARCH,
  icon: HOME_ICON,
  widgetType: 'propertyType',
  defaultProps: { label: 'Type de logement' },
};

/** Filtre additionnel (équipement, budget…). SDK : `createPropertyFilter` (même rendu que le type). */
const FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-filter',
  labelKey: 'studioBlocks.booking-filter.label',
  descriptionKey: 'studioBlocks.booking-filter.description',
  category: CAT_SEARCH,
  icon: SLIDERS_ICON,
  widgetType: 'filter',
  defaultProps: { label: 'Filtres' },
};

/** Sélecteur de devise. SDK : `createCurrencySelector`. */
const CURRENCY_WIDGET: BookingWidgetDef = {
  id: 'booking-currency',
  labelKey: 'studioBlocks.booking-currency.label',
  descriptionKey: 'studioBlocks.booking-currency.description',
  category: CAT_SEARCH,
  icon: COINS_ICON,
  widgetType: 'currency',
  defaultProps: { label: 'EUR' },
};

/** Bouton de validation de la recherche. SDK : `createCTAButton`. */
const SEARCH_BUTTON_WIDGET: BookingWidgetDef = {
  id: 'booking-search-button',
  labelKey: 'studioBlocks.booking-search-button.label',
  descriptionKey: 'studioBlocks.booking-search-button.description',
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
  { name: 'mode', type: 'select', labelKey: 'studioBlocks.traits.mode', options: [{ id: 'all', nameKey: 'studioBlocks.options.all' }, { id: 'limited', nameKey: 'studioBlocks.options.limited' }, { id: 'paginated', nameKey: 'studioBlocks.options.paginated' }] },
  { name: 'limit', type: 'number', labelKey: 'studioBlocks.traits.limit' },
  { name: 'pageSize', type: 'number', labelKey: 'studioBlocks.traits.pageSize' },
  { name: 'cardStyle', type: 'select', labelKey: 'studioBlocks.traits.cardStyle', options: [{ id: 'vertical', nameKey: 'studioBlocks.options.vertical' }, { id: 'horizontal', nameKey: 'studioBlocks.options.horizontal' }, { id: 'overlay', nameKey: 'studioBlocks.options.overlay' }, { id: 'minimal', nameKey: 'studioBlocks.options.minimal' }] },
  { name: 'direction', type: 'select', labelKey: 'studioBlocks.traits.direction', options: [{ id: 'column', nameKey: 'studioBlocks.options.column' }, { id: 'row', nameKey: 'studioBlocks.options.row' }] },
  { name: 'columns', type: 'number', labelKey: 'studioBlocks.traits.columns' },
  { name: 'horizontalScroll', type: 'checkbox', labelKey: 'studioBlocks.traits.horizontalScroll' },
  { name: 'fillEmpty', type: 'checkbox', labelKey: 'studioBlocks.traits.fillEmpty' },
  { name: 'showImage', type: 'checkbox', labelKey: 'studioBlocks.traits.showImage' },
  { name: 'showLocation', type: 'checkbox', labelKey: 'studioBlocks.traits.showLocation' },
  { name: 'showPrice', type: 'checkbox', labelKey: 'studioBlocks.traits.showPrice' },
  { name: 'showBadges', type: 'checkbox', labelKey: 'studioBlocks.traits.showBadges' },
  // Typographie par élément (vide / 0 = hérité du thème).
  { name: 'titleFont', type: 'text', labelKey: 'studioBlocks.traits.titleFont' },
  { name: 'titleSize', type: 'number', labelKey: 'studioBlocks.traits.titleSize' },
  { name: 'titleWeight', type: 'text', labelKey: 'studioBlocks.traits.titleWeight' },
  { name: 'titleColor', type: 'color', labelKey: 'studioBlocks.traits.titleColor' },
  { name: 'locationFont', type: 'text', labelKey: 'studioBlocks.traits.locationFont' },
  { name: 'locationSize', type: 'number', labelKey: 'studioBlocks.traits.locationSize' },
  { name: 'locationColor', type: 'color', labelKey: 'studioBlocks.traits.locationColor' },
  { name: 'priceFont', type: 'text', labelKey: 'studioBlocks.traits.priceFont' },
  { name: 'priceSize', type: 'number', labelKey: 'studioBlocks.traits.priceSize' },
  { name: 'priceWeight', type: 'text', labelKey: 'studioBlocks.traits.priceWeight' },
  { name: 'priceColor', type: 'color', labelKey: 'studioBlocks.traits.priceColor' },
];

/**
 * Liste des logements disponibles (résultats cliquables). SDK : `buildPropertyList(opts)`.
 * `defaultProps` repris à l'identique du `widgetRegistry` (`PROPERTY_RESULTS`) pour un rendu par
 * défaut cohérent dès le dépôt du bloc. `traits` = config par instance (R2b).
 */
const PROPERTY_RESULTS_WIDGET: BookingWidgetDef = {
  id: 'booking-property-results',
  labelKey: 'studioBlocks.booking-property-results.label',
  descriptionKey: 'studioBlocks.booking-property-results.description',
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
  labelKey: 'studioBlocks.booking-price-summary.label',
  descriptionKey: 'studioBlocks.booking-price-summary.description',
  category: CAT_RESULTS,
  icon: RECEIPT_ICON,
  widgetType: 'priceSummary',
};

// ── Panier & options ──

/** Panier multi-séjours. SDK : `createCartList`. */
const CART_WIDGET: BookingWidgetDef = {
  id: 'booking-cart',
  labelKey: 'studioBlocks.booking-cart.label',
  descriptionKey: 'studioBlocks.booking-cart.description',
  category: CAT_CART,
  icon: CART_ICON,
  widgetType: 'cart',
};

/** Ajoute le séjour courant au panier. SDK : `buildAddToCart`. */
const ADD_TO_CART_WIDGET: BookingWidgetDef = {
  id: 'booking-add-to-cart',
  labelKey: 'studioBlocks.booking-add-to-cart.label',
  descriptionKey: 'studioBlocks.booking-add-to-cart.description',
  category: CAT_CART,
  icon: PLUS_ICON,
  widgetType: 'addToCart',
  defaultProps: { label: 'Ajouter au panier' },
};

/** Services additionnels du séjour. SDK : `createAddonsPanel`. */
const ADDONS_WIDGET: BookingWidgetDef = {
  id: 'booking-addons',
  labelKey: 'studioBlocks.booking-addons.label',
  descriptionKey: 'studioBlocks.booking-addons.description',
  category: CAT_CART,
  icon: SPARKLES_ICON,
  widgetType: 'addons',
};

// ── Coordonnées & réservation ──

/** Indicateur de progression du parcours. SDK : `createStepper`. */
const STEPPER_WIDGET: BookingWidgetDef = {
  id: 'booking-stepper',
  labelKey: 'studioBlocks.booking-stepper.label',
  descriptionKey: 'studioBlocks.booking-stepper.description',
  category: CAT_CHECKOUT,
  icon: STEPS_ICON,
  widgetType: 'stepper',
};

/** Formulaire de coordonnées voyageur → paiement. SDK : `createGuestForm`. */
const GUEST_FORM_WIDGET: BookingWidgetDef = {
  id: 'booking-guest-form',
  labelKey: 'studioBlocks.booking-guest-form.label',
  descriptionKey: 'studioBlocks.booking-guest-form.description',
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
  labelKey: 'studioBlocks.booking-inquiry-form.label',
  descriptionKey: 'studioBlocks.booking-inquiry-form.description',
  category: CAT_CHECKOUT,
  icon: MAIL_ICON,
  widgetType: 'inquiryForm',
};

// ── Compte ──

/** Bouton de connexion au compte voyageur. SDK : `buildAccountButton` (null si org inconnue). */
const ACCOUNT_WIDGET: BookingWidgetDef = {
  id: 'booking-account',
  labelKey: 'studioBlocks.booking-account.label',
  descriptionKey: 'studioBlocks.booking-account.description',
  category: CAT_ACCOUNT,
  icon: LOGIN_ICON,
  widgetType: 'account',
  defaultProps: { label: 'Se connecter' },
};

/** Re-booking 1-clic pour le voyageur connecté. SDK : `createRebookStrip` (null si org inconnue). */
const REBOOK_WIDGET: BookingWidgetDef = {
  id: 'booking-rebook',
  labelKey: 'studioBlocks.booking-rebook.label',
  descriptionKey: 'studioBlocks.booking-rebook.description',
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
  labelKey: 'studioBlocks.booking-property-summary.label',
  descriptionKey: 'studioBlocks.booking-property-summary.description',
  category: CAT_RESULTS,
  icon: BED_DOUBLE_ICON,
  widgetType: 'propertySummary',
};

/** Équipements du logement sélectionné. SDK : `createAmenitiesList`. */
const AMENITIES_WIDGET: BookingWidgetDef = {
  id: 'booking-amenities',
  labelKey: 'studioBlocks.booking-amenities.label',
  descriptionKey: 'studioBlocks.booking-amenities.description',
  category: CAT_RESULTS,
  icon: WIFI_ICON,
  widgetType: 'amenities',
};

/** Bouton de paiement isolé → checkout Stripe. SDK : `buildCheckoutButton`. */
const CHECKOUT_BUTTON_WIDGET: BookingWidgetDef = {
  id: 'booking-checkout-button',
  labelKey: 'studioBlocks.booking-checkout-button.label',
  descriptionKey: 'studioBlocks.booking-checkout-button.description',
  category: CAT_CHECKOUT,
  icon: CREDIT_CARD_ICON,
  widgetType: 'checkoutButton',
};

/** Écran de confirmation post-réservation. SDK : `createConfirmationCard` / `buildConfirmation`. */
const CONFIRMATION_WIDGET: BookingWidgetDef = {
  id: 'booking-confirmation',
  labelKey: 'studioBlocks.booking-confirmation.label',
  descriptionKey: 'studioBlocks.booking-confirmation.description',
  category: CAT_CHECKOUT,
  icon: CHECK_CIRCLE_ICON,
  widgetType: 'confirmation',
};

/* ── Critères de filtre AUTONOMES (widgets indépendants, déposables/déplaçables en DnD, ≠ bloc « Filtre »
 *    groupé). Chacun écrit directement un critère de `state.filters` (cf. `mountPrimitive`). ── */
const PRICE_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-price', labelKey: 'studioBlocks.booking-price.label', descriptionKey: 'studioBlocks.booking-price.description',
  category: CAT_SEARCH, icon: COINS_ICON, widgetType: 'filter',
};
const BEDROOMS_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-bedrooms', labelKey: 'studioBlocks.booking-bedrooms.label', descriptionKey: 'studioBlocks.booking-bedrooms.description',
  category: CAT_SEARCH, icon: BED_DOUBLE_ICON, widgetType: 'filter',
};
const BATHROOMS_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-bathrooms', labelKey: 'studioBlocks.booking-bathrooms.label', descriptionKey: 'studioBlocks.booking-bathrooms.description',
  category: CAT_SEARCH, icon: HOME_ICON, widgetType: 'filter',
};
const CAPACITY_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-capacity', labelKey: 'studioBlocks.booking-capacity.label', descriptionKey: 'studioBlocks.booking-capacity.description',
  category: CAT_SEARCH, icon: USERS_ICON, widgetType: 'filter',
};
const AMENITIES_FILTER_WIDGET: BookingWidgetDef = {
  id: 'booking-amenities-filter', labelKey: 'studioBlocks.booking-amenities-filter.label', descriptionKey: 'studioBlocks.booking-amenities-filter.description',
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
  labelKey: 'studioBlocks.booking-reviews.label',
  descriptionKey: 'studioBlocks.booking-reviews.description',
  category: CAT_RESULTS,
  icon: REVIEWS_ICON,
  widgetType: 'reviews',
};

/** Badge note compact (★ 4,7 · N avis) du logement sélectionné. SDK : `createRatingBadge`. */
const RATING_WIDGET: BookingWidgetDef = {
  id: 'booking-rating',
  labelKey: 'studioBlocks.booking-rating.label',
  descriptionKey: 'studioBlocks.booking-rating.description',
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
