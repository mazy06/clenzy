import type { BaitlyBookingConfig, WidgetState } from '../types';
import type { StateManager } from '../state';
import type { BaitlyBookingCore } from '../core/BaitlyBookingCore';
import type { ApiConfirmation, ApiBookingUpsell } from '../api';
import type { BookingI18n } from '../i18n';
import type { BaitlyTheme } from '../types';
import { generateThemeCSS } from '../theme';
import { readNext, readReturn, navigateTo, resolveReturnUrl } from './navigation';

// Factories réutilisées (mêmes que le monolithe `BaitlyWidget`) — aucune ré-implémentation d'UI.
import { createDatePicker } from '../components/DatePicker';
import { createCalendar } from '../components/Calendar';
import { createGuestSelector } from '../components/GuestSelector';
import { createPriceSummary } from '../components/PriceSummary';
import { createCTAButton } from '../components/CTAButton';
import { createGuestForm } from '../components/GuestForm';
import { createPropertyList } from '../components/PropertyList';
import { createCurrencySelector } from '../components/CurrencySelector';
import { createCartList } from '../components/CartList';
import { createPropertyFilter, createPropertyTypeSelect } from '../components/PropertyFilter';
import { createFilterPanel, createPriceFilter, createMinFilter, createAmenitiesFilter } from '../components/FilterPanel';
import { createStepper } from '../components/Stepper';
import { createAddonsPanel } from '../components/AddonsPanel';
import { createRebookStrip } from '../components/RebookStrip';
import { createPropertySummary } from '../components/PropertySummary';
import { createAmenitiesList } from '../components/AmenitiesList';
import { createReviewsList, createRatingBadge } from '../components/Reviews';
import { createConfirmationCard } from '../components/Confirmation';
import { HEADLESS_WIDGETS, ensureStructuralStyles } from '../headless';

// CSS (importé en chaîne par le bundler) — identique à `BaitlyWidget.injectStyles`.
import resetCSS from '../styles/reset.css?raw';
import baseCSS from '../styles/base.css?raw';
import componentsCSS from '../styles/components.css?raw';

/**
 * Étapes de parcours hydratables (valeurs de `data-clenzy-widget`). Multi-pages template-driven (B2) :
 * une primitive par marqueur, toutes branchées sur LE MÊME cœur partagé. Synonymes tolérés (cf. archi
 * §3.2) pour coller aux libellés du template (`results` ≡ `property-list`, `dates` ≡ `availability`…).
 */
export type PrimitiveStep =
  | 'search'
  | 'results'
  | 'property-list'
  | 'property'
  | 'dates'
  | 'availability'
  | 'guests'
  | 'currency'
  | 'cart'
  | 'price'
  | 'guest-form'
  | 'checkout'
  | 'account'
  | 'confirmation'
  | 'upsells';

/** Contexte d'hydratation partagé par tous les marqueurs d'une page. */
export interface MountContext {
  core: BaitlyBookingCore;
  i18n: BookingI18n;
  theme?: BaitlyTheme;
  config: BaitlyBookingConfig;
  /**
   * Mode APERÇU ÉDITEUR (Studio) : neutralise les effets « réels » — navigation pleine page
   * (`navigateTo`), paiement (`runCheckout`) et envoi de demande (`runInquiry`) — pour ne pas casser
   * le canvas ni toucher l'API. Absent/false au runtime (site publié) → comportement complet.
   */
  preview?: boolean;
}

/**
 * Hydrate UN marqueur `el` pour l'étape `step` : crée un Shadow DOM, injecte les styles SDK (comme
 * `BaitlyWidget.injectStyles`), rend la primitive de l'étape via les factories existantes — branchée
 * sur `ctx.core.state`/`ctx.core.api` — et la fait vivre. La plupart des factories s'abonnent déjà à
 * `state.on('*')` (auto re-render) ; pour les étapes SANS factory dédiée (property/confirmation), on
 * s'abonne à `'*'` pour re-render depuis l'état. Idempotence gérée en amont par le bootstrap.
 */
export function mountPrimitive(el: HTMLElement, step: string, ctx: MountContext): void {
  const { core, i18n, theme } = ctx;

  if (i18n.isRTL) el.setAttribute('dir', 'rtl');

  // Headless : rendu en LIGHT DOM (le CSS du template habille le widget) + feuille structurelle seule.
  // Sinon : Shadow DOM isolé + thème/base (ancien comportement). Cf. `HEADLESS_WIDGETS`.
  let root: ShadowRoot | HTMLElement;
  if (HEADLESS_WIDGETS) {
    root = el;
    el.classList.add('cb-widget');
    ensureStructuralStyles(el.ownerDocument);
  } else {
    const styleMode = parseStyleMode(ctx.config.componentConfig);
    root = el.attachShadow({ mode: 'open' });
    injectStyles(root, theme, ctx.config.customCss, styleMode);
  }

  // `el` (le marqueur) porte la navigation template-driven (data-clenzy-next / data-clenzy-return).
  // R2a : les ids granulaires `booking-*` (blocs drag-drop du Studio) sont montés via leurs factories
  // dédiées sur le cœur PARTAGÉ ; les autres valeurs = steps coarse des templates (vocabulaire parcours).
  const node = step.startsWith('booking-')
    ? (renderGranularWidget(step, ctx, el) ?? placeholder(step))
    : renderStep(normalizeStep(step), ctx, el);
  root.appendChild(node);
}

/** Injecte le CSS du widget dans le Shadow DOM (réplique fidèle de `BaitlyWidget.injectStyles`). */
function injectStyles(root: ShadowRoot, theme: BaitlyTheme | undefined, customCss: string | undefined, styleMode: 'template' | 'none'): void {
  if (styleMode === 'none') return;

  const fontFamily = theme?.fontFamily;
  if (!fontFamily || fontFamily.includes('Inter')) {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
    root.appendChild(fontLink);
  }
  const themeStyle = document.createElement('style');
  themeStyle.textContent = generateThemeCSS(theme);
  root.appendChild(themeStyle);
  const mainStyle = document.createElement('style');
  mainStyle.textContent = [resetCSS, baseCSS, componentsCSS].join('\n');
  root.appendChild(mainStyle);

  const custom = customCss?.trim();
  if (custom) {
    const customStyle = document.createElement('style');
    customStyle.setAttribute('data-clenzy-custom', '');
    customStyle.textContent = custom;
    root.appendChild(customStyle);
  }
}

/** Normalise les synonymes d'étape vers une clé canonique. */
function normalizeStep(step: string): PrimitiveStep {
  const s = step.trim().toLowerCase();
  if (s === 'property-list') return 'results';
  if (s === 'availability') return 'dates';
  return (s as PrimitiveStep);
}

/**
 * Mappe une étape vers sa primitive (calqué sur `BaitlyWidget.buildLayoutWidget`). Chaque primitive est
 * branchée sur `core.state`/`core.api` partagés ; les factories gèrent leur propre re-render via `'*'`.
 * `el` (le marqueur) porte la navigation template-driven (`data-clenzy-next` / `data-clenzy-return`, B3).
 */
function renderStep(step: PrimitiveStep, ctx: MountContext, el: HTMLElement): HTMLElement {
  const { core, i18n, config } = ctx;
  const state = core.state;
  const currency = state.get().displayCurrency;
  const baseUrl = config.baseUrl || window.location.origin;

  switch (step) {
    case 'search': {
      // Barre de RECHERCHE composée. Contrat headless (cf. WIDGET-CSS-CONTRACT.md) : conteneur
      // `.cb-widget--composed` dont les ENFANTS DIRECTS sont des `.cb-field` (label + contrôle) + le
      // bouton `.cb-cta` ; le template habille tout via les sélecteurs `.cb-*`. Le layout rangée vient de
      // `structural.css` (le template ne fait que surcharger le cosmétique / le responsive).
      const wrap = document.createElement('div');
      wrap.className = 'cb-search cb-widget--composed';

      // Assemble un champ : <div.cb-field><span.cb-field__label/>…contrôles…</div>.
      const field = (labelText: string, ...controls: HTMLElement[]): HTMLElement => {
        const f = document.createElement('div');
        f.className = 'cb-field';
        const label = document.createElement('span');
        label.className = 'cb-field__label';
        label.textContent = labelText;
        f.appendChild(label);
        controls.forEach((c) => f.appendChild(c));
        return f;
      };

      // Destination : alimente `state.destination` (filtre la liste des logements, cf. PropertyList).
      wrap.appendChild(field(i18n.t('search.destinationLabel'), createDestinationInput(state, i18n)));

      // Dates (arrivée/départ) + calendrier déroulant, et voyageurs (le sélecteur inclut les bébés).
      wrap.appendChild(field(i18n.t('search.datesLabel'), createDatePicker(state, i18n), createCalendar(state, i18n, currency, readCalendarMonths(el))));
      wrap.appendChild(field(i18n.t('guests.title'), createGuestSelector(state, i18n, config.maxGuests || 10)));

      // Bouton Rechercher (enfant direct → ne s'étire pas, cf. structural) → navigation template.
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'cb-cta cb-search__submit';
      submit.textContent = i18n.t('search.submit');
      submit.addEventListener('click', () => { if (!ctx.preview) navigateTo(readNext(el)); });
      wrap.appendChild(submit);

      // Filtres avancés (type de logement…), repliés, sur une ligne pleine largeur sous la barre.
      const advanced = document.createElement('div');
      advanced.className = 'cb-search__advanced';
      const filters = createPropertyFilter(state, i18n, currency);
      filters.style.display = 'none';
      const filtersToggle = document.createElement('button');
      filtersToggle.type = 'button';
      filtersToggle.className = 'cb-search__filters-toggle';
      filtersToggle.textContent = i18n.t('search.filters');
      filtersToggle.setAttribute('aria-expanded', 'false');
      filtersToggle.addEventListener('click', () => {
        const open = filters.style.display === 'none';
        filters.style.display = open ? '' : 'none';
        filtersToggle.setAttribute('aria-expanded', String(open));
      });
      advanced.appendChild(filtersToggle);
      advanced.appendChild(filters);
      wrap.appendChild(advanced);

      return wrap;
    }
    case 'results':
      // Sélection d'un logement → la factory met à jour `selectedPropertyId` ; on observe ce changement
      // pour naviguer vers la page détail déclarée par le template (`data-clenzy-next`), sinon no-op (B2).
      return buildResults(ctx, el);
    case 'dates': {
      const wrap = document.createElement('div');
      wrap.className = 'cb-wdates';
      wrap.appendChild(createDatePicker(state, i18n));
      wrap.appendChild(createCalendar(state, i18n, currency, readCalendarMonths(el)));
      return wrap;
    }
    case 'guests':
      return createGuestSelector(state, i18n, config.maxGuests || 10);
    case 'currency':
      return createCurrencySelector(state);
    case 'price':
      return createPriceSummary(state, i18n);
    case 'cart':
      // Le bouton « Continuer » du panier déclenche le checkout (reserve-batch → Stripe), comme le monolithe.
      return createCartList(state, i18n, () => { void runCheckout(ctx, el); });
    case 'guest-form':
      return createGuestForm(state, i18n, () => { void runCheckout(ctx, el); });
    case 'checkout':
      return buildCheckoutButton(ctx, el);
    case 'property':
      return buildPropertySummary(ctx, el);
    case 'upsells':
      return buildUpsells(ctx);
    case 'confirmation':
      return buildConfirmation(ctx);
    case 'account':
      // Compte voyageur (login/wishlist) : non câblé en B2 (nécessite le contrôleur WishlistAuth du
      // monolithe). Placeholder lisible — TODO B3+ : extraire mountWishlistAuth dans une primitive.
      return placeholder(i18n.t('identification.loginButton') || 'Compte');
    // PropertyFilter exposé pour parité avec buildLayoutWidget (étape non listée mais utile).
    default:
      return createPropertyFilter(state, i18n, currency);
  }
}

/** Options de la liste de logements depuis la config (favoris si org connue). */
function propertyListOpts(config: BaitlyBookingConfig): Parameters<typeof createPropertyList>[3] {
  // Favoris désactivés en B2 (pas de contrôleur WishlistAuth partagé) — sera rebranché en B3+.
  void config;
  return {};
}

/**
 * Liste des logements (étape `results`) avec navigation template-driven (B3). La factory
 * `createPropertyList` met à jour `selectedPropertyId` au clic ; on observe ce passage à un id pour
 * naviguer vers la page détail déclarée par le template (`data-clenzy-next`). Sans attribut : aucune
 * navigation (comportement B2 — le template peut relier ses pages par ses propres liens).
 */
function buildResults(ctx: MountContext, el: HTMLElement): HTMLElement {
  const { core, i18n, config } = ctx;
  const node = createPropertyList(core.state, i18n, config.baseUrl || window.location.origin, propertyListOpts(config));
  attachResultsNav(ctx, el);
  return node;
}

/**
 * Navigation template-driven de la liste de logements : au clic sur un logement (passage de
 * `selectedPropertyId` à un id non nul), navigue vers la page détail déclarée par le template
 * (`data-clenzy-next`). Sans attribut : aucune navigation (le template relie ses pages lui-même).
 * On ne navigue QUE sur une sélection NOUVELLE et non nulle, pas au montage initial (état restauré/URL).
 */
function attachResultsNav(ctx: MountContext, el: HTMLElement): void {
  if (ctx.preview) return; // aperçu éditeur : pas de navigation pleine page
  const next = readNext(el);
  if (!next) return;
  const state = ctx.core.state;
  let prevSelected = state.get().selectedPropertyId;
  state.on('stateChange', (s: WidgetState) => {
    if (s.selectedPropertyId !== prevSelected && s.selectedPropertyId != null) {
      prevSelected = s.selectedPropertyId;
      navigateTo(next);
    } else {
      prevSelected = s.selectedPropertyId;
    }
  });
}

// ─── R2a/R2b — hydratation des blocs drag-drop granulaires (`booking-*`) du Studio ────────────────
// La refonte enregistre 16 blocs granulaires côté éditeur (cf. bookingWidgetDefs) dont le marqueur est
// l'id de la def (`booking-dates`, `booking-property-results`…). Le runtime les monte via les MÊMES
// factories SDK (parité `BaitlyWidget.buildLayoutWidget`) sur le cœur PARTAGÉ. R2b : les options par
// instance sont lues sur le marqueur (attribut JSON `data-clenzy-props`, posé par les traits du Studio).
// Seul `propertyResults` consomme réellement des props (les autres widgets utilisent l'i18n du SDK).

/** Nombre de mois du calendrier, réglé via le trait Studio (`data-clenzy-calendar-months`). Défaut : 2. */
function readCalendarMonths(el: HTMLElement): 1 | 2 {
  return el.getAttribute('data-clenzy-calendar-months') === '1' ? 1 : 2;
}

/** Champ input de destination/ville (alimente `state.destination`). Partagé : barre `search` + widget `booking-city-search`. */
function createDestinationInput(state: StateManager, i18n: BookingI18n): HTMLInputElement {
  const dest = document.createElement('input');
  dest.type = 'text';
  dest.className = 'cb-input cb-search__destination';
  dest.placeholder = i18n.t('search.destination');
  dest.value = state.get().destination;
  dest.setAttribute('aria-label', i18n.t('search.destinationLabel'));
  dest.addEventListener('input', () => { state.set({ destination: dest.value }, 'stateChange'); });
  return dest;
}

/** Props par instance d'un widget, sérialisées par le Studio dans `data-clenzy-props` (JSON). */
function readMarkerProps(el: HTMLElement): Record<string, unknown> {
  const raw = el.getAttribute('data-clenzy-props');
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Style de carte valide (repli `vertical`). Parité `BaitlyWidget.cardStyleOf`. */
function cardStyleOf(v: unknown): 'vertical' | 'horizontal' | 'overlay' | 'minimal' {
  return v === 'horizontal' || v === 'overlay' || v === 'minimal' ? v : 'vertical';
}

/** Google Fonts proposées (typographie par élément). Parité `BaitlyWidget.GOOGLE_FONTS`. */
const GOOGLE_FONTS: Record<string, string> = {
  'playfair display': 'Playfair+Display:wght@400;500;600;700',
  montserrat: 'Montserrat:wght@400;500;600;700',
  poppins: 'Poppins:wght@400;500;600;700',
  lora: 'Lora:wght@400;500;600;700',
  'cormorant garamond': 'Cormorant+Garamond:wght@400;500;600;700',
};

/** Charge à la volée une Google Font connue (sinon système). Parité `BaitlyWidget.ensureFontLoaded`. */
function ensureFontLoaded(css?: string): void {
  if (!css || typeof document === 'undefined') return;
  const primary = css.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  const fam = GOOGLE_FONTS[primary];
  if (!fam || document.querySelector(`link[data-cb-font="${primary}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
  link.dataset.cbFont = primary;
  document.head.appendChild(link);
}

/** Liste de logements paramétrée par les props (parité `BaitlyWidget.buildLayoutWidget` cas `propertyResults`). */
function buildPropertyListFromProps(ctx: MountContext, props: Record<string, unknown>): HTMLElement {
  const { core, i18n, config } = ctx;
  const baseUrl = config.baseUrl || window.location.origin;
  const mode = String(props.mode ?? 'all');
  const limit = mode === 'limited' ? Number(props.limit) || 0 : 0;
  const pageSize = mode === 'paginated' ? Number(props.pageSize) || 0 : 0;
  const str = (k: string): string | undefined => { const v = props[k]; return v != null && v !== '' ? String(v) : undefined; };
  const num = (k: string): number | undefined => { const n = Number(props[k]); return Number.isFinite(n) && n > 0 ? n : undefined; };
  [str('titleFont'), str('locationFont'), str('priceFont')].forEach(ensureFontLoaded);
  return createPropertyList(core.state, i18n, baseUrl, {
    limit, pageSize,
    cardStyle: cardStyleOf(props.cardStyle),
    direction: props.direction === 'row' ? 'row' : 'column',
    columns: Number(props.columns) || 0,
    horizontalScroll: props.horizontalScroll === true,
    fillEmpty: props.fillEmpty === true,
    showImage: props.showImage !== false,
    showLocation: props.showLocation !== false,
    showPrice: props.showPrice !== false,
    showBadges: props.showBadges !== false,
    cardText: {
      title: { font: str('titleFont'), size: num('titleSize'), weight: str('titleWeight'), color: str('titleColor') },
      location: { font: str('locationFont'), size: num('locationSize'), color: str('locationColor') },
      price: { font: str('priceFont'), size: num('priceSize'), weight: str('priceWeight'), color: str('priceColor') },
    },
  });
}

/** Ajoute le séjour courant au panier multi-séjours. Parité `BaitlyWidget.addCurrentStayToCart`. */
function addCurrentStayToCart(state: BaitlyBookingCore['state']): void {
  const s = state.get();
  if (!s.selectedPropertyId || !s.checkIn || !s.checkOut || !s.pricing) return;
  const prop = s.properties.find((p) => p.id === s.selectedPropertyId);
  state.set({
    cart: [...s.cart, {
      propertyId: s.selectedPropertyId,
      propertyName: prop?.name ?? '',
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      guests: s.adults + s.children,
      total: s.pricing.total,
      currency: s.pricing.currency,
    }],
    selectedPropertyId: null,
    checkIn: null,
    checkOut: null,
    pricing: null,
  }, 'stateChange');
}

/**
 * Monte un bloc granulaire `booking-*` via sa factory SDK, branché sur le cœur partagé. Calqué sur
 * `BaitlyWidget.buildLayoutWidget` (mêmes composants), avec la navigation template-driven pour les
 * actions (recherche → results, sélection → détail). `null` = id inconnu (repli placeholder en amont).
 */
function renderGranularWidget(id: string, ctx: MountContext, el: HTMLElement): HTMLElement | null {
  const { core, i18n, config } = ctx;
  const state = core.state;
  const currency = state.get().displayCurrency;
  switch (id) {
    case 'booking-city-search':
      // « Recherche ville » = champ input de destination (≠ liste de logements, cf. bug builder composite).
      return createDestinationInput(state, i18n);
    case 'booking-dates': {
      const wrap = document.createElement('div');
      wrap.className = 'cb-wdates';
      // Présentation opt-in via attributs du marqueur (posés par le template) : style « labeled » (libellé
      // au-dessus + icône) et placeholder personnalisable. Absents = style compact historique (aucun impact).
      const labeled = el.getAttribute('data-clenzy-date-style') === 'labeled';
      const ph = el.getAttribute('data-clenzy-date-placeholder');
      wrap.appendChild(createDatePicker(state, i18n, { labeled, ...(ph !== null ? { placeholder: ph } : {}) }));
      wrap.appendChild(createCalendar(state, i18n, currency));
      return wrap;
    }
    case 'booking-guests':
      return createGuestSelector(state, i18n, config.maxGuests || 10);
    case 'booking-property-type':
      // « Type de logement » = dropdown (select), à la manière du sélecteur de voyageurs.
      return createPropertyTypeSelect(state, i18n, currency);
    case 'booking-filter': {
      // « Filtre » = bouton icône → panneau de sous-filtres CHOISIS + ordonnés au Studio (props `subs`).
      const subs = readMarkerProps(el).subs;
      const subList = Array.isArray(subs) ? subs.filter((x): x is string => typeof x === 'string') : null;
      return createFilterPanel(state, i18n, subList);
    }
    // Critères de filtre AUTONOMES (widgets indépendants) — écrivent directement `state.filters`.
    case 'booking-price':
      return createPriceFilter(state, i18n);
    case 'booking-bedrooms':
      return createMinFilter(state, i18n, 'minBedrooms', (f) => f.maxBedrooms);
    case 'booking-bathrooms':
      return createMinFilter(state, i18n, 'minBathrooms', (f) => f.maxBathrooms);
    case 'booking-capacity':
      return createMinFilter(state, i18n, 'minGuests', (f) => f.maxGuests);
    case 'booking-amenities-filter':
      return createAmenitiesFilter(state, i18n);
    case 'booking-currency':
      return createCurrencySelector(state);
    case 'booking-search-button': {
      // Bouton de RECHERCHE (toujours actif, texte immédiat — ≠ CTA « Réserver » qui exige des dates) →
      // navigue vers la page résultats déclarée par le template (data-clenzy-next).
      const searchBtn = document.createElement('button');
      searchBtn.type = 'button';
      searchBtn.className = 'cb-cta cb-search__submit';
      searchBtn.textContent = i18n.t('search.submit');
      searchBtn.addEventListener('click', () => { if (!ctx.preview) navigateTo(readNext(el)); });
      return searchBtn;
    }
    case 'booking-property-results': {
      const node = buildPropertyListFromProps(ctx, readMarkerProps(el));
      attachResultsNav(ctx, el);
      return node;
    }
    case 'booking-price-summary':
      return createPriceSummary(state, i18n);
    case 'booking-property-summary':
      return buildPropertySummary(ctx, el);
    case 'booking-amenities':
      return createAmenitiesList(state, i18n, { grouped: el.getAttribute('data-clenzy-amenities-layout') === 'grouped' });
    case 'booking-reviews': {
      // Présentation opt-in via attributs du marqueur (posés par le template) : disposition, nombre max,
      // et lien du résumé (`href` → ex. /avis). Sans `limit` → pagination « Charger plus » (tout récupérer).
      const la = el.getAttribute('data-clenzy-reviews-layout');
      const layout = la === 'summary' || la === 'list' ? la : 'full';
      const limit = Number(el.getAttribute('data-clenzy-reviews-limit'));
      const href = el.getAttribute('data-clenzy-reviews-href') || undefined;
      // Aperçu éditeur (`ctx.preview`) → jeu de démo (la clé d'aperçu ne résout aucun avis réel).
      return createReviewsList(core.api, i18n, {
        layout,
        ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
        ...(href ? { href } : {}),
        demo: ctx.preview === true,
      });
    }
    case 'booking-rating': {
      // `href` → le badge devient un lien (ex. vers /avis pour voir tous les avis).
      const href = el.getAttribute('data-clenzy-rating-href') || undefined;
      return createRatingBadge(state, i18n, href ? { href } : {});
    }
    case 'booking-cart':
      return createCartList(state, i18n, () => { void runCheckout(ctx, el); });
    case 'booking-add-to-cart':
      return createCTAButton(state, i18n, () => { addCurrentStayToCart(state); });
    case 'booking-addons':
      return createAddonsPanel(state, i18n, currency);
    case 'booking-stepper':
      return createStepper(0, i18n);
    case 'booking-guest-form':
      return createGuestForm(state, i18n, () => { void runCheckout(ctx, el); });
    case 'booking-inquiry-form':
      // Demande de devis : même formulaire, mais le submit envoie une DEMANDE (pas de paiement Stripe).
      return createGuestForm(state, i18n, () => { void runInquiry(ctx); });
    case 'booking-checkout-button':
      // Bouton de paiement isolé → reserve-batch + checkout (redirection Stripe).
      return buildCheckoutButton(ctx, el);
    case 'booking-confirmation':
      return buildConfirmation(ctx);
    case 'booking-account':
      return placeholder(i18n.t('identification.loginButton') || 'Compte');
    case 'booking-rebook':
      return config.organizationId != null
        ? createRebookStrip(state, i18n, core.api, config.organizationId)
        : placeholder('—');
    default:
      return null;
  }
}

/**
 * Fiche détail du logement sélectionné (étape `property`) : image principale, titre, lieu, prix
 * indicatif. Pas de factory dédiée ni de nouvelle dépendance → on réutilise les classes `.cb-*` de
 * base et on re-rend sur `'*'` (changement de sélection / devise).
 */
function buildPropertySummary(ctx: MountContext, el: HTMLElement): HTMLElement {
  const layout = el.getAttribute('data-clenzy-property-layout') === 'detail' ? 'detail' : undefined;
  const reviewsHref = el.getAttribute('data-clenzy-reviews-href') || undefined;
  return createPropertySummary(ctx.core.state, ctx.config.baseUrl || window.location.origin, ctx.i18n, {
    ...(layout ? { layout } : {}),
    ...(reviewsHref ? { reviewsHref } : {}),
  });
}

/** Formatte un montant en devise (parité avec `PropertyList.formatPrice`, non exporté → dupliqué). */
function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/**
 * Services additionnels (upsells) du booking engine (étape `upsells`, typiquement la page confirmation).
 * Liste les offres `diffuseOnBooking` ; « Ajouter » lance un paiement Stripe HÉBERGÉ (redirection)
 * rattaché à la réservation (code lu sur l'URL `?reservation=`). Sans réservation → boutons désactivés.
 */
function buildUpsells(ctx: MountContext): HTMLElement {
  const { core, config } = ctx;
  const baseUrl = config.baseUrl || window.location.origin;
  const reservationCode = readReturnParams().reservationCode;
  const propertyId = core.state.get().selectedPropertyId ?? undefined;

  const container = document.createElement('div');
  container.className = 'cb-section cb-upsells';
  const list = document.createElement('div');
  list.className = 'cb-upsells__list';
  container.appendChild(list);

  core.api.listUpsells(propertyId)
    .then((items) => {
      if (!items.length) { container.hidden = true; return; }
      container.hidden = false;
      list.textContent = '';
      for (const u of items) list.appendChild(upsellCard(u, reservationCode, baseUrl, ctx));
    })
    .catch(() => { container.hidden = true; });

  return container;
}

/** Carte d'un upsell booking engine (image/titre/prix + bouton « Ajouter » → checkout Stripe hébergé). */
function upsellCard(u: ApiBookingUpsell, reservationCode: string | null, baseUrl: string, ctx: MountContext): HTMLElement {
  const { i18n } = ctx;
  const card = document.createElement('div');
  card.className = 'cb-upsell-card';

  if (u.imageUrl) {
    const img = document.createElement('img');
    img.className = 'cb-upsell-card__img';
    // URL image absolue : telle quelle si http(s) ou data:, sinon préfixée par la base API.
    img.src = /^(https?:|data:)/i.test(u.imageUrl)
      ? u.imageUrl
      : `${baseUrl.replace(/\/$/, '')}${u.imageUrl.startsWith('/') ? '' : '/'}${u.imageUrl}`;
    img.alt = u.title;
    img.loading = 'lazy';
    card.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'cb-upsell-card__body';
  const title = document.createElement('div');
  title.className = 'cb-text-semibold';
  title.textContent = u.title;
  body.appendChild(title);
  if (u.description) {
    const d = document.createElement('p');
    d.className = 'cb-text-sm cb-text-secondary';
    d.textContent = u.description;
    body.appendChild(d);
  }
  const price = document.createElement('div');
  price.className = 'cb-text-semibold cb-upsell-card__price';
  price.textContent = formatPrice(u.price, u.currency);
  body.appendChild(price);
  card.appendChild(body);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cb-cta cb-upsell-card__btn';
  btn.textContent = i18n.t('upsells.add');
  // Achat impossible sans réservation (la commande lie une réservation existante).
  btn.disabled = !reservationCode;
  btn.addEventListener('click', () => {
    if (!reservationCode) return;
    btn.disabled = true;
    ctx.core.api.upsellCheckout(u.offerId, reservationCode, window.location.href)
      .then((r) => { if (r.checkoutUrl) { window.location.href = r.checkoutUrl; } else { btn.disabled = false; } })
      .catch(() => { btn.disabled = false; });
  });
  card.appendChild(btn);
  return card;
}

/**
 * Confirmation post-retour Stripe (B3) : lit les paramètres de retour de l'URL (`?reservation=CODE`,
 * et/ou `session_id` / `status`), re-fetch le statut réel de la réservation via l'API si un code est
 * présent, affiche un état de succès lisible, puis VIDE le panier + la persistance du parcours.
 */
function buildConfirmation(ctx: MountContext): HTMLElement {
  const { core, i18n } = ctx;
  // Carte statique partagée (icône + titre + sous-titre + détails) — enrichie par le re-fetch ci-dessous.
  const card = createConfirmationCard(i18n);

  const params = readReturnParams();
  if (params.reservationCode) {
    void hydrateConfirmation(ctx, params.reservationCode, { title: card.title, subtitle: card.subtitle, details: card.details });
  }

  // Parcours terminé : on libère le panier persistant (le cœur garde la sélection pour un nouveau séjour).
  core.state.set({ cart: [] });
  core.clearPersisted();
  return card.node;
}

/** Paramètres de retour Stripe lus sur l'URL courante. `reservationCode` accepte `reservation` ou `code`. */
function readReturnParams(): { reservationCode: string | null; sessionId: string | null; status: string | null } {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      reservationCode: p.get('reservation') ?? p.get('code'),
      sessionId: p.get('session_id'),
      status: p.get('status'),
    };
  } catch {
    return { reservationCode: null, sessionId: null, status: null };
  }
}

/**
 * Re-fetch le statut réel de la réservation et enrichit la carte de confirmation (titre selon le statut
 * de paiement + récap). Best-effort : un échec laisse la carte de succès statique (le webhook Stripe
 * reste la source de vérité du paiement côté serveur).
 */
async function hydrateConfirmation(
  ctx: MountContext,
  reservationCode: string,
  ui: { title: HTMLElement; subtitle: HTMLElement; details: HTMLElement },
): Promise<void> {
  const { core, i18n } = ctx;
  try {
    const c: ApiConfirmation = await core.api.getConfirmation(reservationCode);
    const paid = c.paymentStatus != null && c.paymentStatus.toUpperCase() === 'PAID';
    ui.title.textContent = paid ? i18n.t('confirmation.confirmed') : i18n.t('confirmation.pending');

    ui.details.textContent = '';
    appendDetail(ui.details, i18n.t('confirmation.reservationNumber'), c.reservationCode);
    if (c.propertyName) appendDetail(ui.details, i18n.t('confirmation.accommodation'), c.propertyName);
    if (c.checkIn && c.checkOut) appendDetail(ui.details, i18n.t('confirmation.duration'), `${c.checkIn} → ${c.checkOut}`);
    appendDetail(ui.details, i18n.t('confirmation.travelers'), String(c.guests));
    if (paid && c.total != null) appendDetail(ui.details, i18n.t('confirmation.totalPaid'), formatPrice(c.total, c.currency));
  } catch {
    /* best-effort : on conserve la carte de succès statique si le re-fetch échoue */
  }
}

/** Ajoute une ligne `terme : valeur` à la liste de détails de la confirmation. */
function appendDetail(list: HTMLElement, label: string, value: string): void {
  const dt = document.createElement('dt');
  dt.className = 'cb-text-sm cb-text-secondary';
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.className = 'cb-text-sm cb-text-semibold';
  dd.textContent = value;
  list.appendChild(dt);
  list.appendChild(dd);
}

/** Bouton de paiement isolé (étape `checkout`) — déclenche reserve + checkout (redirection Stripe). */
function buildCheckoutButton(ctx: MountContext, el: HTMLElement): HTMLElement {
  const { i18n } = ctx;
  return createCTAButton(ctx.core.state, i18n, () => { void runCheckout(ctx, el); });
}

/**
 * Lance le paiement (reserve → checkout → redirection Stripe), avec la navigation template-driven (B3) :
 *  - `data-clenzy-return` (sur le marqueur `el`) → URL absolue de la page confirmation du template,
 *    transmise comme `returnUrl` à `/checkout` (le serveur la valide → `success_url` Stripe) ;
 *  - si AUCUN paiement n'est requis (org sans collecte en ligne), on navigue directement vers la page
 *    confirmation (`data-clenzy-return`, sinon `data-clenzy-next`) — sans attribut : repli B2 (page interne).
 *
 * (DETTE B5 : logique dupliquée depuis `BaitlyWidget.handleCheckout` ; le monolithe garde la sienne.)
 */
async function runCheckout(ctx: MountContext, el: HTMLElement): Promise<void> {
  if (ctx.preview) return; // aperçu éditeur : aucun paiement réel, aucun appel API
  const { core, config } = ctx;
  const state = core.state;
  const api = core.api;
  const s = state.get();
  const name = `${s.guestForm.firstName} ${s.guestForm.lastName}`.trim();
  const guest = { name, email: s.guestForm.email, phone: s.guestForm.phone || undefined };

  // Page confirmation déclarée par le template : sert au retour Stripe (URL absolue, validée serveur)
  // ET à la navigation locale quand aucun paiement n'est requis.
  const returnPath = readReturn(el);
  const nextPath = readNext(el);
  const returnUrl = resolveReturnUrl(returnPath);
  // Vers où aller après une réservation SANS paiement : confirmation prioritaire, sinon `next`.
  const localNext = returnPath ?? nextPath;

  try {
    state.set({ loading: true });

    // Panier multi-séjours : reserve-batch puis paiement du premier item.
    if (s.cart.length > 0) {
      const items = s.cart.map((c) => ({
        propertyId: c.propertyId,
        checkIn: c.checkIn,
        checkOut: c.checkOut,
        guests: c.guests,
      }));
      const batch = await api.reserveBatch({ items, guest }, s.guestToken ?? undefined);
      if (batch.requiresPayment && batch.reservations.length > 0) {
        const checkout = await api.checkout(batch.reservations[0].reservationCode, returnUrl);
        if (checkout.checkoutUrl) { window.location.href = checkout.checkoutUrl; return; }
        throw new Error('checkout URL manquante');
      }
      state.set({ cart: [], page: 'confirmation', loading: false }, 'pageChange');
      config.onBook?.({
        reservationId: batch.batchCode,
        status: 'confirmed',
        checkIn: s.cart[0].checkIn,
        checkOut: s.cart[s.cart.length - 1].checkOut,
        total: batch.grandTotal,
        currency: batch.currency,
      });
      navigateTo(localNext); // no-op si aucun attribut → repli B2
      return;
    }

    if (!s.selectedPropertyId || !s.checkIn || !s.checkOut) {
      state.set({ loading: false });
      return;
    }

    const reservation = await api.reserve({
      propertyId: s.selectedPropertyId,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      guests: s.adults + s.children,
      guest,
      notes: s.guestForm.message || undefined,
    }, s.guestToken ?? undefined);

    if (reservation.requiresPayment) {
      const checkout = await api.checkout(reservation.reservationCode, returnUrl);
      if (checkout.checkoutUrl) { window.location.href = checkout.checkoutUrl; return; }
      throw new Error('checkout URL manquante');
    }

    state.set({ page: 'confirmation', loading: false }, 'pageChange');
    config.onBook?.({
      reservationId: reservation.reservationCode,
      status: reservation.status,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      total: reservation.total,
      currency: reservation.currency,
    });
    navigateTo(localNext); // no-op si aucun attribut → repli B2
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    state.set({ loading: false, error: message }, 'error');
    config.onError?.({ code: 'CHECKOUT_ERROR', message });
  }
}

/**
 * Soumet une DEMANDE DE DEVIS (parcours « Demande de devis ») — SANS paiement. Lit l'état (dates,
 * voyageurs, logement) + les coordonnées du formulaire → `api.submitInquiry`. Affiche la confirmation
 * en cas de succès. (≠ runCheckout : aucun appel Stripe, aucune réservation créée.)
 */
async function runInquiry(ctx: MountContext): Promise<void> {
  if (ctx.preview) return; // aperçu éditeur : aucune demande réellement envoyée
  const { core, config } = ctx;
  const state = core.state;
  const s = state.get();
  const name = `${s.guestForm.firstName} ${s.guestForm.lastName}`.trim();
  try {
    state.set({ loading: true });
    await core.api.submitInquiry({
      propertyId: s.selectedPropertyId ?? undefined,
      checkIn: s.checkIn ?? undefined,
      checkOut: s.checkOut ?? undefined,
      guests: s.adults + s.children,
      name: name || undefined,
      email: s.guestForm.email,
      phone: s.guestForm.phone || undefined,
      message: s.guestForm.message || undefined,
    });
    state.set({ page: 'confirmation', loading: false }, 'pageChange');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    state.set({ loading: false, error: message }, 'error');
    config.onError?.({ code: 'INQUIRY_ERROR', message });
  }
}

/** Placeholder lisible pour les étapes sans factory (account) — n'introduit aucun comportement. */
function placeholder(label: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cb-section cb-placeholder';
  el.textContent = label;
  return el;
}

/** Mode de style du widget : `template` (défaut) ou `none` (headless). Réplique BaitlyWidget. */
function parseStyleMode(componentConfig?: string): 'template' | 'none' {
  if (!componentConfig) return 'template';
  try {
    const m = (JSON.parse(componentConfig) as { styleMode?: unknown }).styleMode;
    return m === 'none' ? 'none' : 'template';
  } catch {
    return 'template';
  }
}
