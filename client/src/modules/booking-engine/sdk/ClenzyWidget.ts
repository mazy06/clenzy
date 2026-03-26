import type { ClenzyBookingConfig, WidgetState, DayAvailability } from './types';
import { StateManager, createInitialState } from './state';
import { generateThemeCSS } from './theme';
import { BookingApi } from './api';
import { createBookingI18n } from './i18n';

// Components
import { createDatePicker } from './components/DatePicker';
import { createCalendar } from './components/Calendar';
import { createGuestSelector } from './components/GuestSelector';
import { createPriceSummary } from './components/PriceSummary';
import { createCTAButton } from './components/CTAButton';
import { createPropertyFilter } from './components/PropertyFilter';
import { createAddonsPanel } from './components/AddonsPanel';
import { createGuestForm } from './components/GuestForm';
import { createStepper } from './components/Stepper';

// CSS (imported as strings by bundler)
import resetCSS from './styles/reset.css?raw';
import baseCSS from './styles/base.css?raw';
import componentsCSS from './styles/components.css?raw';

export class ClenzyWidget {
  private config: ClenzyBookingConfig;
  private state: StateManager;
  private api: BookingApi;
  private i18n: ReturnType<typeof createBookingI18n>;
  private shadowRoot: ShadowRoot | null = null;
  private host: HTMLElement | null = null;
  private unsubscribers: (() => void)[] = [];

  constructor(config: ClenzyBookingConfig) {
    this.config = config;
    this.i18n = createBookingI18n(config.language || 'fr');
    this.api = new BookingApi(
      config.baseUrl || window.location.origin,
      config.apiKey,
    );
    this.state = new StateManager(
      createInitialState({
        adults: config.defaultGuests?.adults ?? 2,
        children: config.defaultGuests?.children ?? 0,
      }),
    );
  }

  mount(): void {
    const container = typeof this.config.container === 'string'
      ? document.querySelector(this.config.container)
      : this.config.container;

    if (!container) {
      console.error('[ClenzyBooking] Container not found:', this.config.container);
      return;
    }

    // Create host element with Shadow DOM
    this.host = document.createElement('div');
    this.host.setAttribute('data-clenzy-booking', '');
    if (this.i18n.isRTL) {
      this.host.setAttribute('dir', 'rtl');
    }
    container.appendChild(this.host);

    this.shadowRoot = this.host.attachShadow({ mode: 'open' });

    // Inject styles
    this.injectStyles();

    // Render widget
    this.renderWidget();

    // Bind API calls to state changes
    this.bindStateEffects();

    // Initial data fetch
    this.fetchAvailability();
  }

  private injectStyles(): void {
    if (!this.shadowRoot) return;

    // Font loading (Inter from Google Fonts if not custom)
    const fontFamily = this.config.theme?.fontFamily;
    if (!fontFamily || fontFamily.includes('Inter')) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
      this.shadowRoot.appendChild(fontLink);
    }

    // Theme CSS variables
    const themeStyle = document.createElement('style');
    themeStyle.textContent = generateThemeCSS(this.config.theme);
    this.shadowRoot.appendChild(themeStyle);

    // Component styles (static, no user input)
    const mainStyle = document.createElement('style');
    mainStyle.textContent = [resetCSS, baseCSS, componentsCSS].join('\n');
    this.shadowRoot.appendChild(mainStyle);
  }

  private renderWidget(): void {
    if (!this.shadowRoot) return;

    const widget = document.createElement('div');
    widget.className = 'cb-widget';

    // Search page
    const searchPage = this.renderSearchPage();
    widget.appendChild(searchPage);

    // Form page (hidden initially)
    const formPage = this.renderFormPage();
    formPage.hidden = true;
    widget.appendChild(formPage);

    // Confirmation page (hidden initially)
    const confirmPage = this.renderConfirmationPage();
    confirmPage.hidden = true;
    widget.appendChild(confirmPage);

    // Powered by
    const powered = document.createElement('div');
    powered.className = 'cb-powered';
    powered.textContent = 'Powered by Clenzy';
    widget.appendChild(powered);

    this.shadowRoot.appendChild(widget);

    // Page switching
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
    const currency = this.config.currency || 'EUR';

    // Property filter (optional)
    if (this.config.showPropertyFilter !== false) {
      page.appendChild(createPropertyFilter(this.state, this.i18n, currency));
    }

    // Date picker
    page.appendChild(createDatePicker(this.state, this.i18n));

    // Calendar (expandable)
    page.appendChild(createCalendar(this.state, this.i18n, currency));

    // Guest selector
    page.appendChild(createGuestSelector(
      this.state,
      this.i18n,
      this.config.maxGuests || 10,
    ));

    // Divider
    const divider = document.createElement('div');
    divider.className = 'cb-divider';
    page.appendChild(divider);

    // Price summary
    page.appendChild(createPriceSummary(this.state, this.i18n));

    // Addons (optional)
    if (this.config.showAddons !== false) {
      page.appendChild(createAddonsPanel(this.state, this.i18n, currency));
    }

    // CTA button
    page.appendChild(createCTAButton(this.state, this.i18n, () => {
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

    // Success icon
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
    // Fetch availability when month or property type changes
    let prevMonth = this.state.get().calendarBaseMonth;
    let prevType = this.state.get().selectedPropertyType;

    this.unsubscribers.push(
      this.state.on('stateChange', (s: WidgetState) => {
        if (s.calendarBaseMonth !== prevMonth || s.selectedPropertyType !== prevType) {
          prevMonth = s.calendarBaseMonth;
          prevType = s.selectedPropertyType;
          this.fetchAvailability();
        }
      }),
    );

    // Fetch pricing when dates change
    this.unsubscribers.push(
      this.state.on('dateSelected', (s: WidgetState) => {
        if (s.checkIn && s.checkOut) {
          this.fetchPricing();
        } else {
          this.state.set({ pricing: null });
        }

        // Notify external callback
        this.config.onDateChange?.({
          checkIn: s.checkIn,
          checkOut: s.checkOut,
        });
      }),
    );

    // Notify price changes
    this.unsubscribers.push(
      this.state.on('priceUpdated', (s: WidgetState) => {
        if (s.pricing) this.config.onPriceChange?.(s.pricing);
      }),
    );
  }

  private async fetchAvailability(): Promise<void> {
    try {
      this.state.set({ loading: true });

      const s = this.state.get();
      const [year, month] = s.calendarBaseMonth.split('-').map(Number);

      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const toDate = new Date(year, month + 1, 0); // last day of next month
      const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;

      const response = await this.api.getAvailability({
        from,
        to,
        types: s.selectedPropertyType ? [s.selectedPropertyType] : undefined,
        guests: s.adults + s.children,
      });

      const availability = new Map<string, DayAvailability>();
      response.days.forEach(day => {
        availability.set(day.date, {
          date: day.date,
          available: day.available,
          minPrice: day.minPrice,
          minNights: day.minNights,
          isCheckInOnly: day.checkInOnly,
          isCheckOutOnly: day.checkOutOnly,
        });
      });

      this.state.set({
        availability,
        propertyTypes: response.propertyTypes.map(pt => ({
          code: pt.code,
          label: pt.label,
          count: pt.count,
          minPrice: pt.minPrice,
        })),
        loading: false,
      });
    } catch (err) {
      this.state.set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load availability',
      }, 'error');
      this.config.onError?.({
        code: 'AVAILABILITY_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  private async fetchPricing(): Promise<void> {
    const s = this.state.get();
    if (!s.checkIn || !s.checkOut) return;

    try {
      this.state.set({ pricingLoading: true });

      const pricing = await this.api.calculatePrice({
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        propertyTypeCode: s.selectedPropertyType || undefined,
        guests: s.adults + s.children,
        addonIds: s.addons.map(a => a.id),
      });

      this.state.set({ pricing, pricingLoading: false }, 'priceUpdated');
    } catch (err) {
      this.state.set({ pricingLoading: false }, 'error');
    }
  }

  private async handleCheckout(): Promise<void> {
    const s = this.state.get();
    if (!s.checkIn || !s.checkOut) return;

    try {
      this.state.set({ loading: true });

      const result = await this.api.createCheckoutSession({
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        propertyTypeCode: s.selectedPropertyType || undefined,
        guests: s.adults + s.children,
        addonIds: s.addons.map(a => a.id),
        guestInfo: {
          firstName: s.guestForm.firstName,
          lastName: s.guestForm.lastName,
          email: s.guestForm.email,
          phone: s.guestForm.phone,
          message: s.guestForm.message || undefined,
        },
      });

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      } else {
        // No payment required — show confirmation
        this.state.set({ page: 'confirmation', loading: false }, 'pageChange');
        this.config.onBook?.({
          reservationId: 'pending',
          status: 'confirmed',
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          total: s.pricing?.total || 0,
          currency: s.pricing?.currency || 'EUR',
        });
      }
    } catch (err) {
      this.state.set({
        loading: false,
        error: err instanceof Error ? err.message : 'Checkout failed',
      }, 'error');
      this.config.onError?.({
        code: 'CHECKOUT_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /** Update theme at runtime */
  updateTheme(theme: Partial<ClenzyBookingConfig['theme']>): void {
    if (!this.shadowRoot) return;
    this.config.theme = { ...this.config.theme, ...theme };
    const themeStyle = this.shadowRoot.querySelector('style');
    if (themeStyle) {
      themeStyle.textContent = generateThemeCSS(this.config.theme);
    }
  }

  /** Change language at runtime */
  setLanguage(lang: 'fr' | 'en' | 'ar'): void {
    this.i18n = createBookingI18n(lang);
    if (this.host) {
      this.host.setAttribute('dir', this.i18n.isRTL ? 'rtl' : 'ltr');
    }
    // Re-render widget
    this.destroy();
    this.mount();
  }

  /** Clean up */
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
