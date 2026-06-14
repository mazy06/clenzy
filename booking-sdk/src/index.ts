import { ApiClient } from './api-client';
import { EventEmitter } from './events';
import { createI18n, getDirection, formatCurrency, formatDate } from './i18n';
import type { I18n, Language } from './i18n';
import type {
  ClenzyBookingOptions,
  BookingConfig,
  Property,
  PropertyDetail,
  AvailabilityRequest,
  AvailabilityResult,
  ReserveRequest,
  ReserveResult,
  CheckoutResult,
  BookingConfirmation,
  BookingError,
  VoucherValidationRequest,
  VoucherValidationResponse,
} from './types';

// Re-export all types for consumers
export type {
  ClenzyBookingOptions,
  BookingConfig,
  Property,
  PropertyDetail,
  PropertyPhoto,
  AvailabilityRequest,
  AvailabilityResult,
  NightBreakdown,
  ReserveRequest,
  ReserveResult,
  GuestInfo,
  CheckoutResult,
  BookingConfirmation,
  BookingError,
  BookingEventMap,
  BookingEventName,
  VoucherChannelScope,
  VoucherValidationError,
  VoucherValidationRequest,
  VoucherValidationResponse,
} from './types';

// Re-export i18n / RTL / formatting utilities (CLZ-P0-12)
export {
  createI18n,
  getDirection,
  isRtl,
  localeTag,
  formatCurrency,
  formatDate,
  formatNumber,
  fr as frMessages,
  en as enMessages,
  ar as arMessages,
} from './i18n';
export type { I18n, Language } from './i18n';

const DEFAULT_BASE_URL = 'https://api.clenzy.fr';
const DEFAULT_TIMEOUT = 15_000;

/**
 * ClenzyBooking — Headless Booking Engine SDK.
 *
 * Provides data + business logic for property reservation.
 * The integrator builds their own UI; this SDK handles:
 * - API calls (config, properties, availability, reserve, checkout)
 * - State events (loading, error, success)
 * - Stripe redirect
 *
 * @example
 * ```js
 * const booking = new ClenzyBooking({
 *   org: 'hotel-paris',
 *   apiKey: 'bk_live_xxxxxx',
 * });
 *
 * const config = await booking.getConfig();
 * const properties = await booking.getProperties();
 * const availability = await booking.checkAvailability({
 *   propertyId: 42,
 *   checkIn: '2026-04-01',
 *   checkOut: '2026-04-04',
 *   guests: 2,
 * });
 * ```
 */
export class ClenzyBooking extends EventEmitter {
  private readonly api: ApiClient;
  private readonly org: string;
  private _loading = false;
  private _language: Language;
  private _currency: string;
  private _t: I18n;

  constructor(options: ClenzyBookingOptions) {
    super();

    if (!options.org) throw new Error('[ClenzyBooking] "org" is required');
    if (!options.apiKey) throw new Error('[ClenzyBooking] "apiKey" is required');

    this.org = options.org;
    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    this.api = new ApiClient(baseUrl, options.apiKey, timeout);

    this._language = options.language ?? 'fr';
    this._currency = options.currency ?? 'EUR';
    this._t = createI18n(this._language);
  }

  // ─── i18n / RTL / formatting (CLZ-P0-12) ──────────────────────────────────

  /** Active UI language. */
  get language(): Language {
    return this._language;
  }

  /** Active display currency. */
  get currency(): string {
    return this._currency;
  }

  /** Reading direction for the active language ('rtl' for Arabic) — apply via `dir`. */
  get direction(): 'rtl' | 'ltr' {
    return getDirection(this._language);
  }

  /** Switch the UI language (rebuilds the embedded translator). */
  setLanguage(language: Language): void {
    this._language = language;
    this._t = createI18n(language);
  }

  /** Switch the display currency (cosmetic; quotes/billing stay server-side). */
  setCurrency(currency: string): void {
    this._currency = currency;
  }

  /** Translate a key with the active language (graceful fallback + {var} interpolation). */
  t(key: string, vars?: Record<string, string | number>): string {
    return this._t(key, vars);
  }

  /** Format an amount in the active (or given) currency + active language. */
  formatPrice(amount: number, currency?: string): string {
    return formatCurrency(amount, currency ?? this._currency, this._language);
  }

  /** Format a date in the active language. */
  formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    return formatDate(date, this._language, options);
  }

  /** Whether the SDK is currently loading data. */
  get loading(): boolean {
    return this._loading;
  }

  // ─── Config ──────────────────────────────────────────────────────────────────

  /**
   * Load the booking engine configuration (theme, currency, policies).
   */
  async getConfig(): Promise<BookingConfig> {
    return this.withLoading(async () => {
      const config = await this.api.get<BookingConfig>(this.path('/config'));
      this.emit('config:loaded', config);
      return config;
    });
  }

  // ─── Properties ────────────────────────────────────────────────────────────

  /**
   * List all properties visible in the booking engine.
   */
  async getProperties(): Promise<Property[]> {
    return this.withLoading(async () => {
      const properties = await this.api.get<Property[]>(this.path('/properties'));
      this.emit('properties:loaded', properties);
      return properties;
    });
  }

  /**
   * Get detailed information about a property.
   */
  async getProperty(propertyId: number): Promise<PropertyDetail> {
    return this.withLoading(async () => {
      const property = await this.api.get<PropertyDetail>(this.path(`/properties/${propertyId}`));
      this.emit('property:loaded', property);
      return property;
    });
  }

  // ─── Availability ──────────────────────────────────────────────────────────

  /**
   * Check availability and calculate pricing for a date range.
   */
  async checkAvailability(request: AvailabilityRequest): Promise<AvailabilityResult> {
    return this.withLoading(async () => {
      const result = await this.api.post<AvailabilityResult>(this.path('/availability'), request);
      this.emit('availability:checked', result);
      return result;
    });
  }

  // ─── Reservation ───────────────────────────────────────────────────────────

  /**
   * Create a PENDING reservation.
   * Must be followed by `checkout()` within 30 minutes.
   */
  async reserve(request: ReserveRequest): Promise<ReserveResult> {
    return this.withLoading(async () => {
      const result = await this.api.post<ReserveResult>(this.path('/reserve'), request);
      this.emit('reservation:created', result);
      return result;
    });
  }

  // ─── Voucher (preview discount avant reserve) ──────────────────────────────

  /**
   * Pre-valide un code voucher dans le contexte du booking en cours et
   * retourne le discount applicable. Utilise pour afficher le prix final
   * au guest AVANT le {@code reserve()} (UX critique : eviter la surprise
   * d'un code refuse au dernier moment).
   *
   * <p>Endpoint public {@code POST /api/public/vouchers/validate}, pas
   * besoin de l'API Key du booking engine (org passe explicitement dans le
   * body). Si le code est valide, le {@code discountAmount} est positif et
   * {@code finalTotal} est le total apres discount.</p>
   *
   * <p>{@code channel} default a 'BOOKING_ENGINE' si non fourni.</p>
   *
   * @example
   * ```js
   * const v = await booking.validateVoucher({
   *   organizationId: 42,
   *   code: 'WELCOME20',
   *   propertyId: 100,
   *   stayNights: 3,
   *   subtotal: 501,
   *   guestEmail: 'jane@example.com',
   * });
   * if (v.valid) {
   *   showDiscount(v.discountAmount, v.finalTotal);
   * } else {
   *   showError(i18n(`voucher.error.${v.errorCode}`));
   * }
   * ```
   */
  async validateVoucher(request: VoucherValidationRequest): Promise<VoucherValidationResponse> {
    return this.withLoading(async () => {
      // L'endpoint /api/public/vouchers/validate n'est PAS org-scope (pas de
      // slug dans le path : l'org est passe explicitement dans le body).
      // On bypass donc path() qui prepend '/api/public/booking/{org}/...'.
      const payload = {
        ...request,
        channel: request.channel ?? 'BOOKING_ENGINE',
      };
      return await this.api.post<VoucherValidationResponse>('/api/public/vouchers/validate', payload);
    });
  }

  // ─── Checkout ──────────────────────────────────────────────────────────────

  /**
   * Create a Stripe Checkout Session and redirect the browser.
   * This navigates the user to Stripe's hosted checkout page.
   *
   * @param reservationCode - The reservation code from `reserve()`
   * @param options.redirect - Whether to auto-redirect (default: true)
   * @returns The checkout URL and session ID
   */
  async checkout(
    reservationCode: string,
    options?: { redirect?: boolean }
  ): Promise<CheckoutResult> {
    return this.withLoading(async () => {
      const result = await this.api.post<CheckoutResult>(this.path('/checkout'), {
        reservationCode,
      });
      this.emit('checkout:started', result);

      // Auto-redirect to Stripe unless explicitly disabled
      if (options?.redirect !== false && typeof window !== 'undefined') {
        window.location.href = result.checkoutUrl;
      }

      return result;
    });
  }

  // ─── Confirmation ──────────────────────────────────────────────────────────

  /**
   * Get the booking confirmation after payment.
   * Call this on the success/return page after Stripe redirect.
   */
  async getConfirmation(reservationCode: string): Promise<BookingConfirmation> {
    return this.withLoading(async () => {
      const confirmation = await this.api.get<BookingConfirmation>(
        this.path(`/booking/${reservationCode}`)
      );
      this.emit('confirmation:loaded', confirmation);
      return confirmation;
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private path(endpoint: string): string {
    return `/api/public/booking/${this.org}${endpoint}`;
  }

  private async withLoading<T>(fn: () => Promise<T>): Promise<T> {
    this._loading = true;
    this.emit('loading', true);
    try {
      return await fn();
    } catch (err) {
      const error: BookingError =
        err && typeof err === 'object' && 'message' in err
          ? (err as BookingError)
          : { message: String(err), code: 'UNKNOWN' };
      this.emit('error', error);
      throw error;
    } finally {
      this._loading = false;
      this.emit('loading', false);
    }
  }
}

// Default export for CDN (IIFE) usage: window.ClenzyBooking
export default ClenzyBooking;
