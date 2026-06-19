import type { BaitlyBookingConfig, WidgetState } from '../types';
import type { BaitlyBookingCore } from '../core/BaitlyBookingCore';
import type { ApiConfirmation } from '../api';
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
import { createPropertyFilter } from '../components/PropertyFilter';

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
  | 'confirmation';

/** Contexte d'hydratation partagé par tous les marqueurs d'une page. */
export interface MountContext {
  core: BaitlyBookingCore;
  i18n: BookingI18n;
  theme?: BaitlyTheme;
  config: BaitlyBookingConfig;
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

  // Style mode (toggle du composeur) : 'none' = headless (aucun CSS injecté), sinon thème + base.
  const styleMode = parseStyleMode(ctx.config.componentConfig);
  const root = el.attachShadow({ mode: 'open' });
  if (i18n.isRTL) el.setAttribute('dir', 'rtl');
  injectStyles(root, theme, ctx.config.customCss, styleMode);

  // `el` (le marqueur) porte la navigation template-driven (data-clenzy-next / data-clenzy-return).
  const node = renderStep(normalizeStep(step), ctx, el);
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
      // Barre de RECHERCHE (≠ ancien widget monolithique : aucune carte logement ni panier ici).
      // Champs : ville + dates + voyageurs (adultes/enfants/bébés) + filtres avancés (repliés) + bouton.
      // Le bouton « Rechercher » navigue vers la page résultats déclarée par le template (data-clenzy-next).
      const wrap = document.createElement('div');
      wrap.className = 'cb-section cb-search';

      // Ville / destination : alimente `state.destination` (filtre la liste des logements, cf. PropertyList).
      const dest = document.createElement('input');
      dest.type = 'text';
      dest.className = 'cb-input cb-search__destination';
      dest.placeholder = i18n.t('search.destination');
      dest.value = state.get().destination;
      dest.setAttribute('aria-label', i18n.t('search.destination'));
      dest.addEventListener('input', () => { state.set({ destination: dest.value }, 'stateChange'); });
      wrap.appendChild(dest);

      // Dates + voyageurs (le sélecteur inclut désormais les bébés).
      wrap.appendChild(createDatePicker(state, i18n));
      wrap.appendChild(createCalendar(state, i18n, currency));
      wrap.appendChild(createGuestSelector(state, i18n, config.maxGuests || 10));

      // Filtres avancés (type de logement…), repliés par défaut, révélés par un bouton.
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
      wrap.appendChild(filtersToggle);
      wrap.appendChild(filters);

      // Bouton Rechercher (toujours actif, ≠ CTA « Réserver » qui exige des dates) → navigation template.
      const submitWrap = document.createElement('div');
      submitWrap.className = 'cb-section';
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'cb-cta cb-search__submit';
      submit.textContent = i18n.t('search.submit');
      submit.addEventListener('click', () => { navigateTo(readNext(el)); });
      submitWrap.appendChild(submit);
      wrap.appendChild(submitWrap);
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
      wrap.appendChild(createCalendar(state, i18n, currency));
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
      return buildPropertySummary(ctx);
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
  const state = core.state;
  const baseUrl = config.baseUrl || window.location.origin;
  const next = readNext(el);

  const node = createPropertyList(state, i18n, baseUrl, propertyListOpts(config));
  if (next) {
    // On ne navigue QUE sur une sélection NOUVELLE et non nulle (clic utilisateur), pas au montage
    // initial où un logement peut déjà être sélectionné (état restauré / URL).
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
  return node;
}

/**
 * Fiche détail du logement sélectionné (étape `property`) : image principale, titre, lieu, prix
 * indicatif. Pas de factory dédiée ni de nouvelle dépendance → on réutilise les classes `.cb-*` de
 * base et on re-rend sur `'*'` (changement de sélection / devise).
 */
function buildPropertySummary(ctx: MountContext): HTMLElement {
  const { core, config } = ctx;
  const baseUrl = config.baseUrl || window.location.origin;
  const container = document.createElement('div');
  container.className = 'cb-section cb-property-summary';

  const render = (s: WidgetState) => {
    const prop = s.properties.find((p) => p.id === s.selectedPropertyId);
    container.textContent = '';

    if (!prop) {
      const empty = document.createElement('p');
      empty.className = 'cb-text-sm cb-text-secondary';
      // Pas de clé i18n dédiée (parité avec le comportement B2) → libellé neutre.
      empty.textContent = '—';
      container.appendChild(empty);
      return;
    }

    if (prop.mainPhotoUrl) {
      const img = document.createElement('img');
      img.className = 'cb-property-summary__image';
      img.src = absoluteImageUrl(prop.mainPhotoUrl, baseUrl);
      img.alt = prop.name;
      img.loading = 'lazy';
      container.appendChild(img);
    }

    const title = document.createElement('h3');
    title.className = 'cb-text-lg cb-text-semibold';
    title.textContent = prop.name;
    container.appendChild(title);

    const place = [prop.city, prop.country].filter(Boolean).join(', ');
    if (place) {
      const loc = document.createElement('p');
      loc.className = 'cb-text-sm cb-text-secondary';
      loc.textContent = place;
      container.appendChild(loc);
    }

    if (prop.priceFrom != null) {
      const price = document.createElement('p');
      price.className = 'cb-text-sm cb-text-semibold';
      price.textContent = formatPrice(prop.priceFrom, prop.currency);
      container.appendChild(price);
    }
  };

  core.state.on('*', (s: WidgetState) => render(s));
  render(core.state.get());
  return container;
}

/** Rend une URL d'image absolue : telle quelle si http(s), sinon préfixée par la base API. */
function absoluteImageUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${baseUrl.replace(/\/$/, '')}${url}`;
  return url;
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
 * Confirmation post-retour Stripe (B3) : lit les paramètres de retour de l'URL (`?reservation=CODE`,
 * et/ou `session_id` / `status`), re-fetch le statut réel de la réservation via l'API si un code est
 * présent, affiche un état de succès lisible, puis VIDE le panier + la persistance du parcours.
 */
function buildConfirmation(ctx: MountContext): HTMLElement {
  const { core, i18n } = ctx;
  const page = document.createElement('div');
  page.className = 'cb-page cb-confirmation';

  const icon = document.createElement('div');
  icon.className = 'cb-confirmation__icon';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '20 6 9 17 4 12');
  svg.appendChild(polyline);
  icon.appendChild(svg);

  const title = document.createElement('h3');
  title.className = 'cb-text-lg cb-text-semibold cb-text-center';
  title.textContent = i18n.t('confirmation.title');
  const subtitle = document.createElement('p');
  subtitle.className = 'cb-text-sm cb-text-secondary cb-text-center';
  subtitle.textContent = i18n.t('confirmation.subtitle');

  page.appendChild(icon);
  page.appendChild(title);
  page.appendChild(subtitle);

  // Détails (référence, hébergement, dates, total) injectés après re-fetch — un seul conteneur réutilisé.
  const details = document.createElement('dl');
  details.className = 'cb-confirmation__details';
  page.appendChild(details);

  const params = readReturnParams();
  if (params.reservationCode) {
    void hydrateConfirmation(ctx, params.reservationCode, { title, subtitle, details });
  }

  // Parcours terminé : on libère le panier persistant (le cœur garde la sélection pour un nouveau séjour).
  core.state.set({ cart: [] });
  core.clearPersisted();
  return page;
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
