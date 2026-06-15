// ─── SDK Public API Types ────────────────────────────────────────────────────

export interface BaitlyBookingConfig {
  container: string | HTMLElement;
  apiKey: string;
  baseUrl?: string;
  /** Slug de l'org dans le path public ; placeholder (l'org est resolue par la cle API X-Booking-Key). */
  slug?: string;
  theme?: BaitlyTheme;
  /**
   * CSS custom de l'organisation, injecté DANS le Shadow DOM du widget (en dernier → surcharge
   * les `.cb-*` de base). Le CSS posé sur la page hôte ne pénètre PAS le shadow : c'est l'unique
   * moyen de styler le module de réservation. Même chaîne que le CSS de page ; les sélecteurs
   * `.bkly-*` y sont simplement inertes (aucun élément correspondant dans le shadow).
   */
  customCss?: string;
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

export interface BaitlyTheme {
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
  /** Taille de police de base (ex. '16px') — met à l'échelle tout le texte du widget. */
  fontSize?: string;
  /** Densité d'espacement : met à l'échelle les paddings/gaps du widget. */
  density?: 'compact' | 'normal' | 'spacious';
  /** Style des boutons d'action. */
  buttonStyle?: 'filled' | 'outlined';
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
  // Property-first : liste + propriete selectionnee
  properties: WidgetProperty[];
  selectedPropertyId: number | null;
  // Multi-devise (BE-L0-1)
  displayCurrency: string;
  currencies: string[];
  availability: Map<string, DayAvailability>;
  pricing: PriceBreakdown | null;
  pricingLoading: boolean;
  // Panier multi-séjours (BE-L0-6)
  cart: CartStay[];
  loading: boolean;
  error: string | null;
  guestForm: GuestFormData;
  guestFormErrors: Partial<Record<keyof GuestFormData, string>>;
  // Champs conserves pour compat composants legacy (PropertyFilter/AddonsPanel), hors flux property-first
  selectedPropertyType: string | null;
  propertyTypes: PropertyTypeInfo[];
  addons: SelectedAddon[];
}

export interface CartStay {
  propertyId: number;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  currency: string;
}

export interface WidgetProperty {
  id: number;
  name: string;
  type: string | null;
  city: string | null;
  country: string | null;
  bedroomCount: number | null;
  bathroomCount: number | null;
  maxGuests: number | null;
  priceFrom: number | null;
  cleaningFee: number | null;
  minimumNights: number | null;
  currency: string;
  mainPhotoUrl: string | null;
  amenities: string[] | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  /** Preuve sociale honnête (2.9) : nombre de réservations. */
  totalBookings: number | null;
  /** Urgence honnête (2.9) : jours disponibles sur 30 jours. */
  availableDays30: number | null;
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
