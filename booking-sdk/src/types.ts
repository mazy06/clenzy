import type { Language } from './i18n';

// ─── SDK Configuration ───────────────────────────────────────────────────────

export interface ClenzyBookingOptions {
  /** Organization slug (e.g., 'hotel-paris') */
  org: string;
  /** Public API Key (e.g., 'bk_live_xxxxxx') */
  apiKey: string;
  /** Base URL of the Clenzy API. Defaults to 'https://api.clenzy.fr' */
  baseUrl?: string;
  /** Request timeout in ms. Defaults to 15000 */
  timeout?: number;
  /** UI language for the embedded i18n pack (fr/en/ar). Defaults to 'fr'. */
  language?: Language;
  /** Display currency (EUR/MAD/SAR…). Cosmetic only — quotes/billing stay server-side. Defaults to 'EUR'. */
  currency?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface BookingConfig {
  primaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  fontFamily: string | null;
  defaultLanguage: string;
  defaultCurrency: string;
  minAdvanceDays: number;
  maxAdvanceDays: number;
  cancellationPolicy: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  collectPaymentOnBooking: boolean;
  showCleaningFee: boolean;
  showTouristTax: boolean;
}

// ─── Property ────────────────────────────────────────────────────────────────

export interface Property {
  id: number;
  name: string;
  type: string | null;
  city: string | null;
  country: string | null;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number | null;
  squareMeters: number | null;
  priceFrom: number | null;
  minimumNights: number | null;
  currency: string;
  mainPhotoUrl: string | null;
  amenities: string[] | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

export interface PropertyDetail {
  id: number;
  name: string;
  description: string | null;
  type: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number | null;
  squareMeters: number | null;
  nightlyPrice: number | null;
  minimumNights: number | null;
  currency: string;
  photos: PropertyPhoto[];
  amenities: string[] | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

export interface PropertyPhoto {
  id: number;
  url: string;
  caption: string | null;
}

// ─── Availability ────────────────────────────────────────────────────────────

export interface AvailabilityRequest {
  propertyId: number;
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD'
  guests: number;
}

export interface AvailabilityResult {
  available: boolean;
  propertyId: number;
  propertyName: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  breakdown: NightBreakdown[];
  subtotal: number;
  cleaningFee: number;
  touristTax: number;
  total: number;
  currency: string | null;
  minStay: number | null;
  maxGuests: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  violations: string[];
}

export interface NightBreakdown {
  date: string;
  price: number;
  rateType: string;
}

// ─── Reservation ─────────────────────────────────────────────────────────────

export interface ReserveRequest {
  propertyId: number;
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD'
  guests: number;
  guest: GuestInfo;
  notes?: string;
  /**
   * Voucher code optionnel saisi par le guest. Valide cote backend, applique
   * automatiquement au prix final si le voucher est valide. En cas de race
   * condition sur le plafond {@code maxUsesTotal}, la reservation est
   * conservee sans discount (degradation gracieuse).
   *
   * <p>Le frontend devrait appeler {@code validateVoucher()} AVANT le
   * {@code reserve()} pour montrer le discount en preview et eviter la
   * surprise UX.</p>
   */
  voucherCode?: string;
}

export interface GuestInfo {
  name: string;
  email: string;
  phone?: string;
}

/** Un séjour du panier multi-séjours (multi-propriétés / multi-créneaux). */
export interface BatchReserveItem {
  propertyId: number;
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD'
  guests: number;
  notes?: string;
}

/** Panier multi-séjours : un seul voyageur, N séjours. */
export interface BatchReserveRequest {
  items: BatchReserveItem[];
  guest: GuestInfo;
}

/**
 * Résultat d'un panier : N réservations PENDING créées atomiquement. Le paiement se fait
 * item par item via {@link ClenzyBooking.checkout} (pas de session Stripe groupée — le
 * {@code batchCode} sert de corrélation).
 */
export interface BatchReserveResult {
  batchCode: string;
  reservations: ReserveResult[];
  grandTotal: number;
  currency: string;
  expiresAt: string;
  requiresPayment: boolean;
}

export interface ReserveResult {
  reservationCode: string;
  status: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  total: number;
  currency: string;
  expiresAt: string;
}

// ─── Vouchers (promos sur les nuitees) ───────────────────────────────────────

/** Canal d'application autorise pour un voucher. */
export type VoucherChannelScope = 'ALL' | 'BOOKING_ENGINE' | 'DIRECT_LINK' | 'WHATSAPP' | 'EMAIL';

/**
 * Codes d'erreur de la validation d'un voucher cote guest. Chaque code se
 * traduit en frontend par un message i18n dedie permettant d'expliquer au
 * voyageur pourquoi son code n'est pas accepte.
 */
export type VoucherValidationError =
  | 'NOT_FOUND'
  | 'DRAFT_NOT_ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'NOT_YET_ACTIVE'
  | 'PROPERTY_NOT_IN_SCOPE'
  | 'MIN_STAY_NOT_MET'
  | 'MAX_STAY_EXCEEDED'
  | 'MIN_TOTAL_NOT_MET'
  | 'USAGE_LIMIT_REACHED'
  | 'GUEST_LIMIT_REACHED'
  | 'CHANNEL_NOT_ALLOWED'
  | 'INVALID_INPUT';

/**
 * Payload pour pre-valider un voucher avant le {@code reserve()}.
 *
 * <p>Le {@code subtotal} doit etre celui calcule par
 * {@link AvailabilityResult.total} (apres frais menage + taxe sejour, donc
 * le total publie). Le backend appliquera le voucher sur ce montant.</p>
 */
export interface VoucherValidationRequest {
  organizationId: number;
  code: string;
  propertyId: number;
  stayNights: number;
  subtotal: number | string;
  /** Optional. Sert au check {@code maxUsesPerGuest}. */
  guestEmail?: string;
  /** Default: 'BOOKING_ENGINE' si non fourni. */
  channel?: VoucherChannelScope;
}

/**
 * Reponse a la validation. {@code valid=true} : {@code discountAmount} et
 * {@code finalTotal} sont remplis pour preview UI. {@code valid=false} :
 * {@code errorCode} indique pourquoi (a traduire en i18n).
 */
export interface VoucherValidationResponse {
  valid: boolean;
  /** Echo du code valide (pour l'UI). NULL si invalid. */
  code: string | null;
  /** Discount calcule en EUR (string pour precision decimal). NULL si invalid. */
  discountAmount: string | null;
  /** Total apres discount en EUR. NULL si invalid. */
  finalTotal: string | null;
  /** Code d'erreur enum (i18n key). NULL si valid. */
  errorCode: VoucherValidationError | null;
  /** Message en clair backend (pour logs/debug). NULL si valid. */
  errorMessage: string | null;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

// ─── Confirmation ────────────────────────────────────────────────────────────

export interface BookingConfirmation {
  reservationCode: string;
  status: string;
  paymentStatus: string | null;
  propertyName: string | null;
  propertyCity: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  subtotal: number;
  cleaningFee: number;
  touristTax: number;
  total: number;
  currency: string;
  guestName: string | null;
  guestEmail: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type BookingEventMap = {
  loading: boolean;
  error: BookingError;
  'config:loaded': BookingConfig;
  'properties:loaded': Property[];
  'property:loaded': PropertyDetail;
  'availability:checked': AvailabilityResult;
  'reservation:created': ReserveResult;
  'checkout:started': CheckoutResult;
  'confirmation:loaded': BookingConfirmation;
};

export type BookingEventName = keyof BookingEventMap;

export interface BookingError {
  message: string;
  status?: number;
  code?: string;
}
