import { ApiClient } from './api-client';
import { EventEmitter } from './events';
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
} from './types';

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

  constructor(options: ClenzyBookingOptions) {
    super();

    if (!options.org) throw new Error('[ClenzyBooking] "org" is required');
    if (!options.apiKey) throw new Error('[ClenzyBooking] "apiKey" is required');

    this.org = options.org;
    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    this.api = new ApiClient(baseUrl, options.apiKey, timeout);
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
