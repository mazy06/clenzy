import type { BaitlyBookingConfig, WidgetState, WidgetProperty, DayAvailability, PriceBreakdown } from './types';
import { StateManager } from './state';
import { generateThemeCSS } from './theme';
import { BookingApi, type ApiProperty, type ApiCalendar, type ApiAvailability } from './api';
import { BaitlyBookingCore } from './core/BaitlyBookingCore';
import { createBookingI18n } from './i18n';

// Components
import { createDatePicker } from './components/DatePicker';
import { createCalendar } from './components/Calendar';
import { createGuestSelector } from './components/GuestSelector';
import { createPriceSummary } from './components/PriceSummary';
import { createCTAButton } from './components/CTAButton';
import { createGuestForm } from './components/GuestForm';
import { createStepper } from './components/Stepper';
import { createPropertyList, type PropertyListOptions } from './components/PropertyList';
import { createPropertyFilter } from './components/PropertyFilter';
import { createCurrencySelector } from './components/CurrencySelector';
import { createCartList } from './components/CartList';
import { createAddonsPanel } from './components/AddonsPanel';
import { mountLeadCapture } from './components/LeadCapture';
import { mountWishlistAuth, type WishlistAuthController } from './components/WishlistAuth';
import { createRebookStrip } from './components/RebookStrip';
import { createPropertySummary } from './components/PropertySummary';
import { createAmenitiesList } from './components/AmenitiesList';
import { createReviewsList, createRatingBadge } from './components/Reviews';
import { createConfirmationCard } from './components/Confirmation';
import { HEADLESS_WIDGETS, ensureStructuralStyles } from './headless';

// CSS (imported as strings by bundler)
import resetCSS from './styles/reset.css?raw';
import baseCSS from './styles/base.css?raw';
import componentsCSS from './styles/components.css?raw';

/**
 * Widget embarquable du Booking Engine — property-first, branché sur la VRAIE API publique
 * ({slug}/properties, /calendar, /availability, /reserve, /checkout) via {@link BookingApi}.
 */
export class BaitlyWidget {
  private config: BaitlyBookingConfig;
  // Cœur headless (B1) : possède state + api + persistance du parcours (survit à la navigation).
  private core: BaitlyBookingCore;
  private state: StateManager;
  private api: BookingApi;
  private i18n: ReturnType<typeof createBookingI18n>;
  // En headless, `shadowRoot` pointe sur l'hôte (light DOM) → toutes les opérations (appendChild /
  // querySelector) restent valides ; le rendu vit alors dans le DOM du template (pas d'isolation).
  private shadowRoot: ShadowRoot | HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private unsubscribers: (() => void)[] = [];
  // Compte voyageur (2.11) — contrôleur du modal login/favoris (créé si organizationId fourni).
  private wishlistAuth: WishlistAuthController | null = null;
  // Parrainage (2.11) : code capté (config ou `?ref=`), rattaché après une réservation directe.
  private referralCode: string | null = null;
  // Suivi des champs déclencheurs de fetch (property / mois / devise).
  private prevPropertyId: number | null = null;
  private prevMonth = '';
  private prevCurrency = '';

  constructor(config: BaitlyBookingConfig) {
    this.config = config;
    this.i18n = createBookingI18n(config.language || 'fr');
    // Le cœur crée l'API + l'état, restaure le parcours persisté (sessionStorage/URL) et le maintient.
    this.core = new BaitlyBookingCore({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || window.location.origin,
      slug: config.slug,
      defaults: {
        adults: config.defaultGuests?.adults ?? 2,
        children: config.defaultGuests?.children ?? 0,
        displayCurrency: config.currency || 'EUR',
      },
    });
    this.api = this.core.api;
    this.state = this.core.state;
  }

  mount(): void {
    const container = typeof this.config.container === 'string'
      ? document.querySelector(this.config.container)
      : this.config.container;
    if (!container) {
      console.error('[BaitlyBooking] Container not found:', this.config.container);
      return;
    }

    this.host = document.createElement('div');
    this.host.setAttribute('data-clenzy-booking', '');
    if (this.i18n.isRTL) this.host.setAttribute('dir', 'rtl');
    container.appendChild(this.host);

    // Headless : pas de Shadow DOM → le widget vit dans le light DOM du template (qui l'habille).
    this.shadowRoot = HEADLESS_WIDGETS ? this.host : this.host.attachShadow({ mode: 'open' });
    this.injectStyles();

    // Parrainage (2.11) : code passé en config ou via `?ref=` dans l'URL de la page hôte.
    this.referralCode = this.config.referralCode?.trim() || readReferralCodeFromUrl();

    // Compte voyageur (2.11) : modal login/favoris monté seulement si l'org est connue.
    if (this.config.organizationId != null) {
      this.wishlistAuth = mountWishlistAuth({
        root: this.shadowRoot,
        api: this.api,
        i18n: this.i18n,
        state: this.state,
        organizationId: this.config.organizationId,
      });
    }

    this.renderWidget();
    this.bindStateEffects();

    // Capture de lead par exit-intent (2.12) — OPT-IN : affichée seulement si activée explicitement
    // (`leadCapture === true`). Off par défaut → n'apparaît jamais sans qu'on l'ait demandée.
    this.unsubscribers.push(
      mountLeadCapture({
        root: this.shadowRoot,
        api: this.api,
        i18n: this.i18n,
        locale: this.config.language || 'fr',
        enabled: this.config.leadCapture === true,
        storageKey: `cb_lead_${this.config.apiKey}`,
      }),
    );

    // Données initiales : devises + propriétés.
    this.fetchCurrencies();
    this.fetchProperties();
  }

  private injectStyles(): void {
    if (!this.shadowRoot) return;
    // Headless : aucune injection de thème/cosmétique — seule la feuille STRUCTURELLE (light DOM),
    // une fois par document. Le template habille le widget.
    if (HEADLESS_WIDGETS) {
      ensureStructuralStyles(this.host?.ownerDocument);
      return;
    }
    // Mode de style (toggle du composeur) : 'none' = headless → AUCUN CSS injecté dans le Shadow DOM
    // (le widget rend du HTML brut, à styler entièrement soi-même). 'template' (défaut) = thème +
    // CSS de base + CSS custom de l'org.
    if (parseStyleMode(this.config.componentConfig) === 'none') return;
    const fontFamily = this.config.theme?.fontFamily;
    if (!fontFamily || fontFamily.includes('Inter')) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
      this.shadowRoot.appendChild(fontLink);
    }
    const themeStyle = document.createElement('style');
    themeStyle.textContent = generateThemeCSS(this.config.theme);
    this.shadowRoot.appendChild(themeStyle);
    const mainStyle = document.createElement('style');
    mainStyle.textContent = [resetCSS, baseCSS, componentsCSS].join('\n');
    this.shadowRoot.appendChild(mainStyle);

    // CSS custom de l'org : injecté EN DERNIER (même spécificité → l'emporte sur les `.cb-*` de base).
    // Unique moyen d'atteindre le widget : le CSS de la page hôte ne franchit pas le Shadow DOM.
    const custom = this.config.customCss?.trim();
    if (custom) {
      const customStyle = document.createElement('style');
      customStyle.setAttribute('data-clenzy-custom', '');
      customStyle.textContent = custom;
      this.shadowRoot.appendChild(customStyle);
    }
  }

  private renderWidget(): void {
    if (!this.shadowRoot) return;
    // Mode composé : l'hôte a défini sa propre composition → le widget n'est qu'un conteneur de
    // mise en page (pas de « carte » beige imposée, pas de marque). Sinon : expérience par défaut.
    const composed = parseWidgetLayout(this.config.componentConfig).length > 0;
    const widget = document.createElement('div');
    widget.className = composed ? 'cb-widget cb-widget--composed' : 'cb-widget';

    const searchPage = this.renderSearchPage();
    widget.appendChild(searchPage);

    const formPage = this.renderFormPage();
    formPage.hidden = true;
    widget.appendChild(formPage);

    const confirmPage = this.renderConfirmationPage();
    confirmPage.hidden = true;
    widget.appendChild(confirmPage);

    // « Powered by » : seulement pour l'expérience par défaut (WYSIWYG en composé : pas de marque ajoutée).
    if (!composed) {
      const powered = document.createElement('div');
      powered.className = 'cb-powered';
      powered.textContent = 'Powered by Baitly';
      widget.appendChild(powered);
    }

    this.shadowRoot.appendChild(widget);

    this.unsubscribers.push(
      this.state.on('pageChange', (s: WidgetState) => {
        searchPage.hidden = s.page !== 'search';
        formPage.hidden = s.page !== 'form';
        confirmPage.hidden = s.page !== 'confirmation';
      }),
    );
  }

  private renderSearchPage(): HTMLElement {
    const page = document.createElement('div');
    page.className = 'cb-page';
    const currency = this.state.get().displayCurrency;

    // CTA → formulaire (réservation simple, si propriété + dates choisies).
    const goToForm = () => {
      const s = this.state.get();
      if (s.selectedPropertyId && s.checkIn && s.checkOut) {
        this.state.set({ page: 'form' }, 'pageChange');
      }
    };

    // Composition Studio (micro-widgets) si fournie & valide, sinon formulaire de recherche figé.
    const layout = parseWidgetLayout(this.config.componentConfig);
    if (layout.length > 0) {
      this.renderComposedSearch(page, layout, currency, goToForm, parseStyleMode(this.config.componentConfig));
    } else {
      this.renderDefaultSearch(page, currency, goToForm);
    }
    return page;
  }

  /** Formulaire de recherche par défaut (property-first) : ordre figé historique, panier inclus. */
  private renderDefaultSearch(page: HTMLElement, currency: string, goToForm: () => void): void {
    // Re-booking 1-clic (2.11) : bandeau « Réserver à nouveau » pour le voyageur connecté.
    if (this.config.organizationId != null) {
      page.appendChild(createRebookStrip(this.state, this.i18n, this.api, this.config.organizationId));
    }
    page.appendChild(createCurrencySelector(this.state));
    page.appendChild(this.buildPropertyList());
    page.appendChild(createDatePicker(this.state, this.i18n));
    page.appendChild(createCalendar(this.state, this.i18n, currency));
    page.appendChild(createGuestSelector(this.state, this.i18n, this.config.maxGuests || 10));
    const divider = document.createElement('div');
    divider.className = 'cb-divider';
    page.appendChild(divider);
    page.appendChild(createPriceSummary(this.state, this.i18n));
    page.appendChild(createCTAButton(this.state, this.i18n, goToForm));
    // Panier multi-séjours : add-to-cart + liste (total + "Continuer").
    page.appendChild(this.buildAddToCart());
    page.appendChild(createCartList(this.state, this.i18n, () => this.state.set({ page: 'form' }, 'pageChange')));
  }

  /**
   * Rend la barre de réservation composée dans le Studio (micro-widgets). Chaque widget est mappé
   * vers son composant fonctionnel (mêmes liaisons d'état que le formulaire par défaut). Un conteneur
   * `group` agrège ses enfants dans une boîte flex (ligne/colonne). Dédoublonnage par composant (deux
   * sélecteurs de dates n'ont pas de sens). Si la composition n'expose aucun bouton de recherche, on
   * en ajoute un (sinon le séjour ne pourrait jamais être validé).
   */
  private renderComposedSearch(page: HTMLElement, layout: LayoutNode[], currency: string, goToForm: () => void, styleMode: 'template' | 'none'): void {
    // Builder LIBRE : aucun dédoublonnage — l'hôte peut placer le même micro-widget plusieurs fois
    // (ex. deux listes de logements stylées différemment). Chaque nœud composé est rendu tel quel.
    // Mappe clic→calque dans l'aperçu d'édition : on tague chaque élément rendu avec l'id éphémère
    // du nœud (injecté par le composeur). Absent en prod → aucun effet.
    const tag = (el: HTMLElement | null, node: LayoutNode): HTMLElement | null => {
      if (el && node.id) el.dataset.cbNode = node.id;
      return el;
    };
    const leaf = (node: LayoutNode): HTMLElement | null => tag(this.buildLayoutWidget(node, currency, goToForm), node);
    const build = (node: LayoutNode): HTMLElement | null => {
      if (node.type === 'group') {
        const box = document.createElement('div');
        box.className = 'cb-wgroup';
        const props = node.props ?? {};
        const dir = props.direction === 'column' ? 'column' : 'row';
        const gap = String(props.gap || 'md');
        // Intention de layout exposée en data-* → le CSS de la page/template peut piloter en headless.
        box.dataset.direction = dir;
        box.dataset.gap = gap;
        box.dataset.wrap = props.wrap === false ? 'false' : 'true';
        // En headless, AUCUN style inline : c'est au template/CSS de gérer la mise en page.
        if (styleMode !== 'none') {
          box.style.display = 'flex';
          box.style.flexDirection = dir;
          box.style.flexWrap = props.wrap === false ? 'nowrap' : 'wrap';
          box.style.alignItems = dir === 'column' ? 'stretch' : 'flex-end';
          box.style.gap = WGROUP_GAP[gap] ?? WGROUP_GAP.md;
        }
        (node.children ?? []).forEach((child) => {
          if (child.type === 'group') return; // pas d'imbrication de conteneur
          const el = leaf(child);
          if (el) box.appendChild(el);
        });
        return box.childElementCount > 0 ? tag(box, node) : null;
      }
      return leaf(node);
    };
    // WYSIWYG : on rend UNIQUEMENT la composition. Aucun bouton « Réserver » auto-ajouté — pour valider
    // un séjour, l'hôte ajoute le micro-widget « Bouton Rechercher » ou « Ajouter au panier ».
    layout.forEach((node) => {
      const el = build(node);
      if (el) page.appendChild(el);
    });
  }

  /** Mappe un micro-widget Studio vers son composant fonctionnel (ou null si type inconnu/indispo). */
  private buildLayoutWidget(node: LayoutNode, currency: string, goToForm: () => void): HTMLElement | null {
    const type = node.type;
    switch (type) {
      case 'citySearch':
        return this.buildPropertyList();
      case 'propertyResults': {
        // Paramètres du composeur : mode (limite/pagination), disposition, colonnes, cartes vides, toggles.
        const props = node.props ?? {};
        const mode = String(props.mode ?? 'all');
        const limit = mode === 'limited' ? Number(props.limit) || 0 : 0;
        const pageSize = mode === 'paginated' ? Number(props.pageSize) || 0 : 0;
        // Typographie par élément (vide / 0 = hérité du thème).
        const str = (k: string): string | undefined => { const v = props[k]; return v != null && v !== '' ? String(v) : undefined; };
        const num = (k: string): number | undefined => { const n = Number(props[k]); return Number.isFinite(n) && n > 0 ? n : undefined; };
        // Charge les Google Fonts choisies (sinon système → rien).
        [str('titleFont'), str('locationFont'), str('priceFont')].forEach(ensureFontLoaded);
        return this.buildPropertyList({
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
      case 'dates': {
        const wrap = document.createElement('div');
        wrap.className = 'cb-wdates';
        wrap.appendChild(createDatePicker(this.state, this.i18n));
        wrap.appendChild(createCalendar(this.state, this.i18n, currency));
        return wrap;
      }
      case 'guests':
        return createGuestSelector(this.state, this.i18n, this.config.maxGuests || 10);
      case 'propertyType':
      case 'filter':
        return createPropertyFilter(this.state, this.i18n, currency);
      case 'currency':
        return createCurrencySelector(this.state);
      case 'searchButton':
        return createCTAButton(this.state, this.i18n, goToForm);
      case 'priceSummary':
        return createPriceSummary(this.state, this.i18n);
      case 'propertySummary':
        return createPropertySummary(this.state, this.config.baseUrl || window.location.origin, this.i18n);
      case 'amenities':
        return createAmenitiesList(this.state, this.i18n);
      case 'reviews':
        return createReviewsList(this.api, this.i18n, { layout: 'full' });
      case 'rating':
        return createRatingBadge(this.state, this.i18n);
      case 'cart':
        return createCartList(this.state, this.i18n, () => this.state.set({ page: 'form' }, 'pageChange'));
      case 'addToCart':
        return this.buildAddToCart();
      case 'addons':
        return createAddonsPanel(this.state, this.i18n, currency);
      case 'stepper':
        // Indicateur de progression (statique : étape « Séjours & Options »).
        return createStepper(0, this.i18n);
      case 'guestForm':
        // Coordonnées voyageur (booking sur une seule page). Le submit déclenche le checkout normal
        // (recalcul serveur ; no-op tant que propriété + dates ne sont pas sélectionnées).
        return createGuestForm(this.state, this.i18n, () => { void this.handleCheckout(); });
      case 'inquiryForm':
        // Demande de devis (aperçu éditeur) : même formulaire, sans soumission réelle.
        return createGuestForm(this.state, this.i18n, () => { /* aperçu : pas de soumission */ });
      case 'checkoutButton':
        // Bouton de paiement (aperçu éditeur) : CTA sans soumission réelle (le runtime lance Stripe).
        return createCTAButton(this.state, this.i18n, () => { /* aperçu : pas de paiement */ });
      case 'confirmation':
        // Écran de confirmation (aperçu éditeur) : carte statique, sans lecture d'URL ni effet de bord.
        return createConfirmationCard(this.i18n).node;
      case 'account':
        // Compte voyageur : bouton de connexion (modal login/favoris). Indispo si org inconnue.
        return this.wishlistAuth ? this.buildAccountButton() : null;
      case 'rebook':
        return this.config.organizationId != null
          ? createRebookStrip(this.state, this.i18n, this.api, this.config.organizationId)
          : null;
      default:
        return null;
    }
  }

  /** Bouton « Ajouter au panier » : ajoute le séjour courant au panier multi-séjours. */
  private buildAddToCart(): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cb-cta cb-cta--secondary cb-add-to-cart';
    btn.textContent = this.i18n.t('cart.addStay');
    btn.addEventListener('click', () => this.addCurrentStayToCart());
    return btn;
  }

  /** Bouton « Se connecter » : ouvre le modal login/favoris du compte voyageur. */
  private buildAccountButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cb-cta cb-cta--secondary cb-account';
    btn.textContent = this.i18n.t('identification.loginButton');
    btn.addEventListener('click', () => this.wishlistAuth?.requireAuth(() => { /* connecté : favoris/re-booking activés */ }));
    return btn;
  }

  /** Liste de propriétés (sélection property-first) + cœurs favoris si compte voyageur actif. */
  private buildPropertyList(opts?: {
    limit?: number; pageSize?: number; cardStyle?: 'vertical' | 'horizontal' | 'overlay' | 'minimal';
    direction?: 'row' | 'column'; columns?: number; horizontalScroll?: boolean; fillEmpty?: boolean;
    showImage?: boolean; showLocation?: boolean; showPrice?: boolean; showBadges?: boolean;
    cardText?: PropertyListOptions['cardText'];
  }): HTMLElement {
    return createPropertyList(
      this.state,
      this.i18n,
      this.config.baseUrl || window.location.origin,
      {
        ...(this.config.organizationId != null
          ? { wishlistEnabled: true, onWishlistToggle: (id: number) => this.handleWishlistToggle(id) }
          : {}),
        ...(opts?.limit ? { limit: opts.limit } : {}),
        ...(opts?.pageSize ? { pageSize: opts.pageSize } : {}),
        ...(opts?.direction ? { direction: opts.direction } : {}),
        ...(opts?.columns ? { columns: opts.columns } : {}),
        ...(opts?.cardStyle ? { cardStyle: opts.cardStyle } : {}),
        ...(opts?.cardText ? { cardText: opts.cardText } : {}),
        ...(opts?.horizontalScroll ? { horizontalScroll: true } : {}),
        ...(opts?.fillEmpty ? { fillEmpty: true } : {}),
        ...(opts && opts.showImage === false ? { showImage: false } : {}),
        ...(opts && opts.showLocation === false ? { showLocation: false } : {}),
        ...(opts && opts.showPrice === false ? { showPrice: false } : {}),
        ...(opts && opts.showBadges === false ? { showBadges: false } : {}),
      },
    );
  }

  private renderFormPage(): HTMLElement {
    return createGuestForm(this.state, this.i18n, () => {
      this.handleCheckout();
    });
  }

  private renderConfirmationPage(): HTMLElement {
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
    title.textContent = this.i18n.t('confirmation.title');
    const subtitle = document.createElement('p');
    subtitle.className = 'cb-text-sm cb-text-secondary cb-text-center';
    subtitle.textContent = this.i18n.t('confirmation.subtitle');

    page.appendChild(icon);
    page.appendChild(title);
    page.appendChild(subtitle);
    return page;
  }

  private bindStateEffects(): void {
    this.prevPropertyId = this.state.get().selectedPropertyId;
    this.prevMonth = this.state.get().calendarBaseMonth;
    this.prevCurrency = this.state.get().displayCurrency;

    // Re-fetch sur changement de propriété / mois / devise.
    this.unsubscribers.push(
      this.state.on('stateChange', (s: WidgetState) => {
        const currencyChanged = s.displayCurrency !== this.prevCurrency;
        const propertyChanged = s.selectedPropertyId !== this.prevPropertyId;
        const monthChanged = s.calendarBaseMonth !== this.prevMonth;
        this.prevCurrency = s.displayCurrency;
        this.prevPropertyId = s.selectedPropertyId;
        this.prevMonth = s.calendarBaseMonth;

        if (currencyChanged) {
          this.fetchProperties();
          if (s.selectedPropertyId) this.fetchCalendar();
          if (s.checkIn && s.checkOut) this.fetchPricing();
        } else if (propertyChanged) {
          this.fetchCalendar();
        } else if (monthChanged) {
          this.fetchCalendar();
        }
      }),
    );

    // Prix quand les dates changent (via /availability).
    this.unsubscribers.push(
      this.state.on('dateSelected', (s: WidgetState) => {
        if (s.checkIn && s.checkOut) this.fetchPricing();
        else this.state.set({ pricing: null });
        this.config.onDateChange?.({ checkIn: s.checkIn, checkOut: s.checkOut });
      }),
    );

    this.unsubscribers.push(
      this.state.on('priceUpdated', (s: WidgetState) => {
        if (s.pricing) this.config.onPriceChange?.(s.pricing);
      }),
    );
  }

  private async fetchCurrencies(): Promise<void> {
    try {
      const currencies = await this.api.getCurrencies();
      if (Array.isArray(currencies) && currencies.length) {
        this.state.set({ currencies });
      }
    } catch {
      // best-effort : pas de sélecteur si l'endpoint échoue
    }
  }

  private async fetchProperties(): Promise<void> {
    try {
      this.state.set({ loading: true });
      const currency = this.state.get().displayCurrency;
      const apiProps = await this.api.getProperties(currency);
      const properties: WidgetProperty[] = apiProps.map(mapProperty);

      const s = this.state.get();
      // Auto-sélection si une seule propriété.
      const selectedPropertyId = s.selectedPropertyId
        ?? (properties.length === 1 ? properties[0].id : null);
      this.state.set({ properties, selectedPropertyId, loading: false }, 'stateChange');
    } catch (err) {
      this.state.set({ loading: false, error: msg(err) }, 'error');
      this.config.onError?.({ code: 'PROPERTIES_ERROR', message: msg(err) });
    }
  }

  private async fetchCalendar(): Promise<void> {
    const s = this.state.get();
    if (!s.selectedPropertyId) {
      this.state.set({ availability: new Map() });
      return;
    }
    try {
      this.state.set({ loading: true });
      const cal: ApiCalendar = await this.api.getCalendar(
        s.selectedPropertyId, s.calendarBaseMonth, 2, s.displayCurrency,
      );
      this.state.set({ availability: toAvailabilityMap(cal), loading: false });
    } catch (err) {
      this.state.set({ loading: false, error: msg(err) }, 'error');
      this.config.onError?.({ code: 'CALENDAR_ERROR', message: msg(err) });
    }
  }

  private async fetchPricing(): Promise<void> {
    const s = this.state.get();
    if (!s.selectedPropertyId || !s.checkIn || !s.checkOut) return;
    try {
      this.state.set({ pricingLoading: true });
      const avail: ApiAvailability = await this.api.checkAvailability(
        { propertyId: s.selectedPropertyId, checkIn: s.checkIn, checkOut: s.checkOut, guests: s.adults + s.children },
        s.displayCurrency,
        s.guestToken ?? undefined, // tarif membre (2.8) si voyageur connecté
      );
      if (!avail.available) {
        this.state.set({ pricing: null, pricingLoading: false, error: avail.violations?.[0] ?? null }, 'error');
        return;
      }
      this.state.set({ pricing: toPriceBreakdown(avail, this.i18n), pricingLoading: false }, 'priceUpdated');
    } catch (err) {
      this.state.set({ pricingLoading: false, error: msg(err) }, 'error');
    }
  }

  /** Ajoute le séjour courant (propriété + dates + prix) au panier, puis réinitialise la sélection. */
  private addCurrentStayToCart(): void {
    const s = this.state.get();
    if (!s.selectedPropertyId || !s.checkIn || !s.checkOut || !s.pricing) return;
    const prop = s.properties.find(p => p.id === s.selectedPropertyId);
    const item = {
      propertyId: s.selectedPropertyId,
      propertyName: prop?.name ?? '',
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      guests: s.adults + s.children,
      children: s.children,
      total: s.pricing.total,
      currency: s.pricing.currency,
    };
    this.state.set({
      cart: [...s.cart, item],
      selectedPropertyId: null,
      checkIn: null,
      checkOut: null,
      pricing: null,
    }, 'stateChange');
  }

  /**
   * Bascule un favori (2.11) : ouvre le login si la session guest est absente, sinon toggle.
   * Mise à jour optimiste (cœur instantané) puis réconciliation avec la liste serveur ; rollback
   * en cas d'échec réseau.
   */
  private handleWishlistToggle(propertyId: number): void {
    const orgId = this.config.organizationId;
    if (orgId == null || !this.wishlistAuth) return;
    this.wishlistAuth.requireAuth(() => {
      const s = this.state.get();
      const token = s.guestToken;
      if (!token) return;
      const previous = s.wishlist;
      const isWishlisted = previous.includes(propertyId);
      const optimistic = isWishlisted
        ? previous.filter(id => id !== propertyId)
        : [...previous, propertyId];
      this.state.set({ wishlist: optimistic }, 'stateChange');
      const request = isWishlisted
        ? this.api.wishlistRemove(orgId, propertyId, token)
        : this.api.wishlistAdd(orgId, propertyId, token);
      request
        .then((ids) => this.state.set({ wishlist: ids }, 'stateChange'))
        .catch(() => this.state.set({ wishlist: previous }, 'stateChange'));
    });
  }

  /**
   * Parrainage (2.11) : rattache le filleul à son parrain après une réservation directe. Best-effort
   * (le crédit n'est accordé qu'au séjour terminé) ; un échec n'interrompt jamais le paiement.
   */
  private maybeClaimReferral(reservationCode: string): void {
    const orgId = this.config.organizationId;
    if (!this.referralCode || orgId == null || !reservationCode) return;
    this.api.claimReferral(orgId, reservationCode, this.referralCode).catch(() => {
      /* best-effort : code invalide / filleul déjà parrainé → ignoré */
    });
  }

  private async handleCheckout(): Promise<void> {
    const s = this.state.get();
    const name = `${s.guestForm.firstName} ${s.guestForm.lastName}`.trim();
    const guest = { name, email: s.guestForm.email, phone: s.guestForm.phone || undefined };

    // Panier multi-séjours : reserve-batch puis paiement item par item.
    if (s.cart.length > 0) {
      await this.handleBatchCheckout(s, guest);
      return;
    }

    if (!s.selectedPropertyId || !s.checkIn || !s.checkOut) return;

    try {
      this.state.set({ loading: true });
      const reservation = await this.api.reserve({
        propertyId: s.selectedPropertyId,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        guests: s.adults + s.children,
        children: s.children,
        guest,
        notes: s.guestForm.message || undefined,
      }, s.guestToken ?? undefined); // tarif membre (2.8)

      this.maybeClaimReferral(reservation.reservationCode);

      if (reservation.requiresPayment) {
        const checkout = await this.api.checkout(reservation.reservationCode);
        if (checkout.checkoutUrl) {
          window.location.href = checkout.checkoutUrl;
          return;
        }
        throw new Error('checkout URL manquante');
      }

      // Pas de paiement requis → confirmation.
      this.state.set({ page: 'confirmation', loading: false }, 'pageChange');
      this.config.onBook?.({
        reservationId: reservation.reservationCode,
        status: reservation.status,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        total: reservation.total,
        currency: reservation.currency,
      });
    } catch (err) {
      this.state.set({ loading: false, error: msg(err) }, 'error');
      this.config.onError?.({ code: 'CHECKOUT_ERROR', message: msg(err) });
    }
  }

  /** Panier multi-séjours : crée les N réservations (reserve-batch) puis paie item par item. */
  private async handleBatchCheckout(
    s: WidgetState,
    guest: { name: string; email: string; phone?: string },
  ): Promise<void> {
    try {
      this.state.set({ loading: true });
      const items = s.cart.map(c => ({
        propertyId: c.propertyId,
        checkIn: c.checkIn,
        checkOut: c.checkOut,
        guests: c.guests,
        children: c.children,
      }));
      const batch = await this.api.reserveBatch({ items, guest }, s.guestToken ?? undefined); // tarif membre (2.8)

      if (batch.reservations.length > 0) {
        this.maybeClaimReferral(batch.reservations[0].reservationCode);
      }

      if (batch.requiresPayment && batch.reservations.length > 0) {
        // Paiement item par item : on démarre le checkout du premier séjour.
        const checkout = await this.api.checkout(batch.reservations[0].reservationCode);
        if (checkout.checkoutUrl) {
          window.location.href = checkout.checkoutUrl;
          return;
        }
        throw new Error('checkout URL manquante');
      }

      this.state.set({ page: 'confirmation', cart: [], loading: false }, 'pageChange');
      this.config.onBook?.({
        reservationId: batch.batchCode,
        status: 'confirmed',
        checkIn: s.cart[0].checkIn,
        checkOut: s.cart[s.cart.length - 1].checkOut,
        total: batch.grandTotal,
        currency: batch.currency,
      });
    } catch (err) {
      this.state.set({ loading: false, error: msg(err) }, 'error');
      this.config.onError?.({ code: 'CHECKOUT_ERROR', message: msg(err) });
    }
  }

  /** Update theme at runtime */
  updateTheme(theme: Partial<BaitlyBookingConfig['theme']>): void {
    // Headless : pas de thème injecté → rien à mettre à jour (le template gouverne le rendu).
    if (HEADLESS_WIDGETS || !this.shadowRoot) return;
    this.config.theme = { ...this.config.theme, ...theme };
    const themeStyle = this.shadowRoot.querySelector('style');
    if (themeStyle) themeStyle.textContent = generateThemeCSS(this.config.theme);
  }

  /** Change language at runtime */
  setLanguage(lang: 'fr' | 'en' | 'ar'): void {
    this.config.language = lang;
    this.i18n = createBookingI18n(lang);
    if (this.host) this.host.setAttribute('dir', this.i18n.isRTL ? 'rtl' : 'ltr');
    this.destroy();
    this.mount();
  }

  /** Switch the display currency at runtime. */
  setCurrency(currency: string): void {
    this.state.set({ displayCurrency: currency }, 'stateChange');
  }

  destroy(): void {
    this.unsubscribers.forEach(fn => fn());
    this.unsubscribers = [];
    this.wishlistAuth?.destroy();
    this.wishlistAuth = null;
    this.core.destroy();
    if (this.host) {
      this.host.remove();
      this.host = null;
    }
    this.shadowRoot = null;
  }
}

// ─── Composition Studio (widgetLayout) ─────────────────────────────────────────

/** Nœud de disposition sérialisé par le composeur Studio (`{ type, props?, children? }`). */
interface LayoutNode {
  type: string;
  props?: Record<string, unknown>;
  children?: LayoutNode[];
  /** Id ÉPHÉMÈRE injecté par le composeur (aperçu d'édition) pour mapper clic→calque. Absent en prod. */
  id?: string;
}

const WGROUP_GAP: Record<string, string> = { sm: '8px', md: '12px', lg: '20px' };

/** Normalise la disposition de carte du composeur vers une valeur valide (défaut `vertical`). */
function cardStyleOf(v: unknown): 'vertical' | 'horizontal' | 'overlay' | 'minimal' {
  return v === 'horizontal' || v === 'overlay' || v === 'minimal' ? v : 'vertical';
}

/** Google Fonts proposées dans le composeur (typographie par élément) → params css2. */
const GOOGLE_FONTS: Record<string, string> = {
  'playfair display': 'Playfair+Display:wght@400;500;600;700',
  'montserrat': 'Montserrat:wght@400;500;600;700',
  'poppins': 'Poppins:wght@400;500;600;700',
  'lora': 'Lora:wght@400;500;600;700',
  'cormorant garamond': 'Cormorant+Garamond:wght@400;500;600;700',
};

/**
 * Charge à la volée la police choisie si c'est une Google Font connue (sinon : système, rien à faire).
 * Injectée dans `document.head` : le chargement de polices est global → s'applique aussi au Shadow DOM.
 */
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

/** Mode de style du widget : `template` (défaut, design appliqué) ou `none` (headless, aucun CSS). */
function parseStyleMode(componentConfig?: string): 'template' | 'none' {
  if (!componentConfig) return 'template';
  try {
    const m = (JSON.parse(componentConfig) as { styleMode?: unknown }).styleMode;
    return m === 'none' ? 'none' : 'template';
  } catch {
    return 'template';
  }
}

/** Lit la disposition `widgetLayout` depuis `componentConfig` (JSON). [] si absent/illisible. */
function parseWidgetLayout(componentConfig?: string): LayoutNode[] {
  if (!componentConfig) return [];
  try {
    const obj = JSON.parse(componentConfig);
    const arr = (obj as { widgetLayout?: unknown })?.widgetLayout;
    if (!Array.isArray(arr)) return [];
    return arr.filter((n): n is LayoutNode => !!n && typeof n === 'object' && typeof (n as LayoutNode).type === 'string');
  } catch {
    return [];
  }
}

// ─── Mappers API -> état widget ────────────────────────────────────────────────

function mapProperty(p: ApiProperty): WidgetProperty {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    city: p.city,
    country: p.country,
    bedroomCount: p.bedroomCount,
    bathroomCount: p.bathroomCount,
    maxGuests: p.maxGuests,
    priceFrom: p.priceFrom,
    cleaningFee: p.cleaningFee,
    minimumNights: p.minimumNights,
    currency: p.currency,
    mainPhotoUrl: p.mainPhotoUrl,
    photoUrls: p.photoUrls ?? [],
    amenities: p.amenities,
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
    description: p.description ?? null,
    rating: p.rating ?? null,
    reviewCount: p.reviewCount ?? 0,
    totalBookings: p.totalBookings,
    availableDays30: p.availableDays30,
  };
}

function toAvailabilityMap(cal: ApiCalendar): Map<string, DayAvailability> {
  const map = new Map<string, DayAvailability>();
  cal.days.forEach(d => {
    map.set(d.date, {
      date: d.date,
      available: d.available,
      minPrice: d.price,
      minNights: d.minNights,
      isCheckInOnly: d.checkInOnly,
      isCheckOutOnly: d.checkOutOnly,
    });
  });
  return map;
}

function toPriceBreakdown(a: ApiAvailability, i18n: { t: (k: string) => string }): PriceBreakdown {
  const nightlyRate = a.nights > 0 ? a.subtotal / a.nights : 0;
  // Book Direct & Save (2.8) : a.subtotal est déjà remisé → la ligne de base montre le tarif PLEIN
  // (public) et une ligne « réservation directe » expose l'économie ; le net retombe sur a.subtotal.
  const directDiscount = a.directDiscount ?? 0;
  const fullSubtotal = a.subtotal + directDiscount;
  const lines: PriceBreakdown['lines'] = [
    { label: `${a.nights} ${i18n.t('cart.nights')}`, amount: fullSubtotal, type: 'base' },
  ];
  if (directDiscount > 0) {
    lines.push({ label: i18n.t('price.directDiscount'), amount: -directDiscount, type: 'discount' });
  }
  if (a.cleaningFee > 0) lines.push({ label: i18n.t('validation.cleaningFee'), amount: a.cleaningFee, type: 'fee' });
  if (a.touristTax > 0) lines.push({ label: i18n.t('validation.touristTax'), amount: a.touristTax, type: 'fee' });
  return {
    nightlyRate,
    nights: a.nights,
    subtotal: a.subtotal,
    cleaningFee: a.cleaningFee,
    addonsTotal: 0,
    total: a.total,
    currency: a.currency,
    lines,
  };
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

/** Parrainage (2.11) : lit le code dans `?ref=` de l'URL de la page hôte (null si absent/indispo). */
function readReferralCodeFromUrl(): string | null {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    return ref && ref.trim() ? ref.trim() : null;
  } catch {
    return null;
  }
}
