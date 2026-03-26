// ─── SDK Public API Types ────────────────────────────────────────────────────

export interface ClenzyBookingConfig {
  container: string | HTMLElement;
  apiKey: string;
  baseUrl?: string;
  theme?: ClenzyTheme;
  language?: 'fr' | 'en' | 'ar';
  currency?: string;
  defaultGuests?: { adults: number; children: number };
  maxGuests?: number;
  minNights?: number;
  maxNights?: number;
  propertyTypes?: string[];
  showPropertyFilter?: boolean;
  showAddons?: boolean;
  showReviews?: boolean;
  onBook?: (reservation: BookingResult) => void;
  onError?: (error: BookingError) => void;
  onPriceChange?: (price: PriceBreakdown) => void;
  onDateChange?: (dates: { checkIn: string | null; checkOut: string | null }) => void;
}

export interface ClenzyTheme {
  primaryColor?: string;
  primaryHoverColor?: string;
  primaryLightColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  textColor?: string;
  textSecondaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  shadow?: string;
}

// ─── Internal State ──────────────────────────────────────────────────────────

export interface WidgetState {
  page: 'search' | 'form' | 'payment' | 'confirmation';
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  children: number;
  calendarOpen: boolean;
  calendarBaseMonth: string; // YYYY-MM
  guestsOpen: boolean;
  selectedPropertyType: string | null;
  availability: Map<string, DayAvailability>;
  propertyTypes: PropertyTypeInfo[];
  pricing: PriceBreakdown | null;
  pricingLoading: boolean;
  addons: SelectedAddon[];
  loading: boolean;
  error: string | null;
  guestForm: GuestFormData;
  guestFormErrors: Partial<Record<keyof GuestFormData, string>>;
}

export interface DayAvailability {
  date: string;
  available: boolean;
  minPrice: number | null;
  minNights: number;
  isCheckInOnly?: boolean;
  isCheckOutOnly?: boolean;
}

export interface PropertyTypeInfo {
  code: string;
  label: string;
  count: number;
  minPrice: number | null;
}

export interface PriceBreakdown {
  nightlyRate: number;
  nights: number;
  subtotal: number;
  cleaningFee: number;
  addonsTotal: number;
  total: number;
  currency: string;
  lines: PriceLine[];
}

export interface PriceLine {
  label: string;
  amount: number;
  type: 'base' | 'fee' | 'addon' | 'discount' | 'total';
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface GuestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
}

export interface BookingResult {
  reservationId: string;
  status: string;
  checkIn: string;
  checkOut: string;
  total: number;
  currency: string;
}

export interface BookingError {
  code: string;
  message: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface CalendarAvailabilityResponse {
  days: ApiDayAvailability[];
  propertyTypes: ApiPropertyTypeInfo[];
}

export interface ApiDayAvailability {
  date: string;
  available: boolean;
  minPrice: number | null;
  minNights: number;
  checkInOnly?: boolean;
  checkOutOnly?: boolean;
}

export interface ApiPropertyTypeInfo {
  code: string;
  label: string;
  count: number;
  minPrice: number | null;
}

// ─── State Events ────────────────────────────────────────────────────────────

export type StateEvent =
  | 'stateChange'
  | 'calendarToggle'
  | 'guestsToggle'
  | 'dateSelected'
  | 'priceUpdated'
  | 'pageChange'
  | 'error';
