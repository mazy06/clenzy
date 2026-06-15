import type { BaitlyBookingConfig, WidgetState, WidgetProperty, DayAvailability, PriceBreakdown } from './types';
import { StateManager, createInitialState } from './state';
import { generateThemeCSS } from './theme';
import { BookingApi, type ApiProperty, type ApiCalendar, type ApiAvailability } from './api';
import { createBookingI18n } from './i18n';

// Components
import { createDatePicker } from './components/DatePicker';
import { createCalendar } from './components/Calendar';
import { createGuestSelector } from './components/GuestSelector';
import { createPriceSummary } from './components/PriceSummary';
import { createCTAButton } from './components/CTAButton';
import { createGuestForm } from './components/GuestForm';
import { createPropertyList } from './components/PropertyList';
import { createCurrencySelector } from './components/CurrencySelector';
import { createCartList } from './components/CartList';
import { mountLeadCapture } from './components/LeadCapture';

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
  private state: StateManager;
  private api: BookingApi;
  private i18n: ReturnType<typeof createBookingI18n>;
  private shadowRoot: ShadowRoot | null = null;
  private host: HTMLElement | null = null;
  private unsubscribers: (() => void)[] = [];
  // Suivi des champs déclencheurs de fetch (property / mois / devise).
  private prevPropertyId: number | null = null;
  private prevMonth = '';
  private prevCurrency = '';

  constructor(config: BaitlyBookingConfig) {
    this.config = config;
    this.i18n = createBookingI18n(config.language || 'fr');
    this.api = new BookingApi(config.baseUrl || window.location.origin, config.apiKey, config.slug);
    this.state = new StateManager(
      createInitialState({
        adults: config.defaultGuests?.adults ?? 2,
        children: config.defaultGuests?.children ?? 0,
        displayCurrency: config.currency || 'EUR',
      }),
    );
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

    this.shadowRoot = this.host.attachShadow({ mode: 'open' });
    this.injectStyles();
    this.renderWidget();
    this.bindStateEffects();

    // Capture de lead par exit-intent (2.12) — affichée une fois par session, gated par config.
    this.unsubscribers.push(
      mountLeadCapture({
        root: this.shadowRoot,
        api: this.api,
        i18n: this.i18n,
        locale: this.config.language || 'fr',
        enabled: this.config.leadCapture !== false,
        storageKey: `cb_lead_${this.config.apiKey}`,
      }),
    );

    // Données initiales : devises + propriétés.
    this.fetchCurrencies();
    this.fetchProperties();
  }

  private injectStyles(): void {
    if (!this.shadowRoot) return;
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
    const widget = document.createElement('div');
    widget.className = 'cb-widget';

    const searchPage = this.renderSearchPage();
    widget.appendChild(searchPage);

    const formPage = this.renderFormPage();
    formPage.hidden = true;
    widget.appendChild(formPage);

    const confirmPage = this.renderConfirmationPage();
    confirmPage.hidden = true;
    widget.appendChild(confirmPage);

    const powered = document.createElement('div');
    powered.className = 'cb-powered';
    powered.textContent = 'Powered by Baitly';
    widget.appendChild(powered);

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

    // Sélecteur de devise (masqué si une seule devise)
    page.appendChild(createCurrencySelector(this.state));

    // Liste de propriétés (sélection property-first)
    page.appendChild(createPropertyList(this.state, this.i18n, this.config.baseUrl || window.location.origin));

    // Sélection des dates (date picker + calendrier alimenté par /calendar de la propriété)
    page.appendChild(createDatePicker(this.state, this.i18n));
    page.appendChild(createCalendar(this.state, this.i18n, currency));

    // Voyageurs
    page.appendChild(createGuestSelector(this.state, this.i18n, this.config.maxGuests || 10));

    const divider = document.createElement('div');
    divider.className = 'cb-divider';
    page.appendChild(divider);

    // Récapitulatif prix (depuis /availability)
    page.appendChild(createPriceSummary(this.state, this.i18n));

    // CTA → formulaire (réservation simple, si propriété + dates choisies)
    page.appendChild(createCTAButton(this.state, this.i18n, () => {
      const s = this.state.get();
      if (s.selectedPropertyId && s.checkIn && s.checkOut) {
        this.state.set({ page: 'form' }, 'pageChange');
      }
    }));

    // Ajouter au panier (multi-séjours) : ajoute le séjour courant + réinitialise la sélection.
    const addToCart = document.createElement('button');
    addToCart.type = 'button';
    addToCart.className = 'cb-cta cb-cta--secondary cb-add-to-cart';
    addToCart.textContent = this.i18n.t('cart.addStay');
    addToCart.addEventListener('click', () => this.addCurrentStayToCart());
    page.appendChild(addToCart);

    // Panier multi-séjours : liste + total + "Continuer".
    page.appendChild(createCartList(this.state, this.i18n, () => {
      this.state.set({ page: 'form' }, 'pageChange');
    }));

    return page;
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
        guest,
        notes: s.guestForm.message || undefined,
      });

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
      }));
      const batch = await this.api.reserveBatch({ items, guest });

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
    if (!this.shadowRoot) return;
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
    this.state.destroy();
    if (this.host) {
      this.host.remove();
      this.host = null;
    }
    this.shadowRoot = null;
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
    amenities: p.amenities,
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
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
