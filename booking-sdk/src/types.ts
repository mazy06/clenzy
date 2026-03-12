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
}

export interface GuestInfo {
  name: string;
  email: string;
  phone?: string;
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
