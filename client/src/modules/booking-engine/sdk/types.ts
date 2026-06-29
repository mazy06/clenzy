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
  /**
   * Disposition de la barre de réservation composée dans le Studio (micro-widgets), sérialisée en
   * JSON `{ widgetLayout: [...] }` (champ `componentConfig` de la config). Si présente et valide, le
   * widget rend cette composition ; sinon il retombe sur le formulaire de recherche par défaut. La
   * disposition est purement présentationnelle — le flux de réservation et les montants restent
   * pilotés par le serveur.
   */
  componentConfig?: string;
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
  /** Capture de lead par exit-intent (2.12). OPT-IN : mettre `true` pour activer (off par défaut). */
  leadCapture?: boolean;
  /** Id numérique de l'organisation (2.11) — requis pour le compte voyageur (login/wishlist). */
  organizationId?: number;
  /** Parrainage (2.11) : code de parrainage à rattacher après réservation (sinon lu depuis `?ref=`). */
  referralCode?: string;
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
  /** Bébés (0-3 ans) : saisis dans la recherche, NON comptés dans la capacité (gratuits). */
  infants: number;
  calendarOpen: boolean;
  calendarBaseMonth: string; // YYYY-MM
  guestsOpen: boolean;
  /** Id du multi-select actuellement ouvert (un seul popover ouvert à la fois), `null` = aucun. */
  multiselectOpen: string | null;
  /** Destination saisie dans la barre de recherche (ville) ; filtre la liste des logements. */
  destination: string;
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
  // Compte voyageur (2.11) — session in-memory (jamais en localStorage, cf. règle #7) + favoris.
  guestToken: string | null;
  guestEmail: string | null;
  wishlist: number[];
  // Champs conserves pour compat composants legacy (PropertyFilter/AddonsPanel), hors flux property-first
  selectedPropertyType: string | null;
  propertyTypes: PropertyTypeInfo[];
  addons: SelectedAddon[];
  // Recherche multi-critères (widget « Filtre ») : `filters` pilote le refetch server-side ET le filtrage
  // client de la liste ; `filterFacets` = options disponibles (types/équipements/bornes), cf. /search-filters.
  filters: SearchFilters;
  filterFacets: FilterFacets | null;
}

/** Critères de filtre de la recherche (envoyés au backend + appliqués côté client sur la liste). */
export interface SearchFilters {
  types: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  minGuests: number | null;
  amenities: string[];
}

/** Une option de filtre + le nombre de propriétés concernées (facette). */
export interface FilterFacet {
  code: string;
  count: number;
}

/** Options disponibles pour construire l'UI du widget « Filtre » (cf. endpoint `/search-filters`). */
export interface FilterFacets {
  propertyTypes: FilterFacet[];
  amenities: FilterFacet[];
  priceMin: number | null;
  priceMax: number | null;
  maxBedrooms: number;
  maxBathrooms: number;
  maxGuests: number;
  currency: string | null;
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
  /** Galerie : toutes les photos du logement (peut inclure la photo principale). */
  photoUrls: string[];
  amenities: string[] | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  /** Note moyenne des avis publics (0..5), null si aucun avis. */
  rating: number | null;
  /** Nombre d'avis publics. */
  reviewCount: number;
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
  | 'msToggle'
  | 'dateSelected'
  | 'priceUpdated'
  | 'pageChange'
  | 'error';
