import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Lightweight status (used by dashboard widget). */
export interface BookingEngineStatus {
  configured: boolean;
  enabled: boolean;
  apiKey?: string;
  templateCount?: number;
}

/** AI-extracted design tokens (21 properties). */
export interface DesignTokens {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  surfaceColor?: string | null;
  textColor?: string | null;
  textSecondaryColor?: string | null;
  headingFontFamily?: string | null;
  bodyFontFamily?: string | null;
  baseFontSize?: string | null;
  headingFontWeight?: string | null;
  borderRadius?: string | null;
  buttonBorderRadius?: string | null;
  cardBorderRadius?: string | null;
  spacing?: string | null;
  boxShadow?: string | null;
  cardShadow?: string | null;
  buttonStyle?: string | null;
  buttonTextTransform?: string | null;
  borderColor?: string | null;
  dividerColor?: string | null;
}

/** Response from AI design analysis endpoint. */
export interface AiDesignAnalysisResponse {
  designTokens: DesignTokens;
  generatedCss: string;
  sourceUrl: string;
  fromCache: boolean;
}

/** Response from AI CSS generation endpoint. */
export interface AiCssGenerateResponse {
  generatedCss: string;
}

/** Full admin config (used by /booking-engine settings page). */
export interface BookingEngineConfig {
  id: number;
  organizationId: number;
  name: string;
  enabled: boolean;
  apiKey: string;
  // Theming
  primaryColor: string;
  accentColor: string | null;
  logoUrl: string | null;
  fontFamily: string | null;
  // Behavior
  defaultLanguage: string;
  defaultCurrency: string;
  minAdvanceDays: number;
  maxAdvanceDays: number;
  // Policies
  cancellationPolicy: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  // Security
  allowedOrigins: string | null;
  // Options
  collectPaymentOnBooking: boolean;
  autoConfirm: boolean;
  showCleaningFee: boolean;
  showTouristTax: boolean;
  // Custom CSS/JS + Component Config
  customCss: string | null;
  customJs: string | null;
  componentConfig: string | null;
  // AI Design Analysis
  designTokens: string | null;
  sourceWebsiteUrl: string | null;
  aiAnalysisAt: string | null;
  // Widget Integration Position
  widgetPosition: string | null;
  inlineTargetId: string | null;
  inlinePlacement: string | null;
  // Cross-org (populated only for platform staff /configs/all endpoint)
  organizationName?: string | null;
}

/** Update payload — excludes id, orgId, apiKey, enabled (managed via dedicated endpoints). */
export type BookingEngineConfigUpdate = Omit<BookingEngineConfig, 'id' | 'organizationId' | 'apiKey' | 'enabled'>;

// ─── Calendar Availability Types ──────────────────────────────────────────────

export interface AvailabilityDay {
  date: string;
  available: boolean;
  minPrice: number | null;
  availableCount: number;
  availableTypes: string[];
}

export interface PropertyTypeInfo {
  type: string;
  label: string;
  count: number;
  minPrice: number | null;
  minCleaningFee: number | null;
}

export interface CalendarAvailabilityResponse {
  days: AvailabilityDay[];
  propertyTypes: PropertyTypeInfo[];
}

// ─── Review Types ─────────────────────────────────────────────────────────────

export interface ReviewStats {
  averageRating: number;
  totalCount: number;
  distribution: Record<number, number>;
}

// ─── Guest Auth Types ─────────────────────────────────────────────────────────

export interface GuestRegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  organizationId: number;
}

export interface GuestLoginData {
  email: string;
  password: string;
  organizationId: number;
}

export interface GuestProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  organizationId: number;
  emailVerified: boolean;
}

export interface GuestAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  profile: GuestProfile;
}

// ─── Public Property Detail ──────────────────────────────────────────────────

export interface PublicPropertyDetail {
  id: number;
  name: string;
  description: string | null;
  type: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  bedroomCount: number | null;
  bathroomCount: number | null;
  maxGuests: number | null;
  squareMeters: number | null;
  nightlyPrice: number | null;
  minimumNights: number | null;
  currency: string | null;
  photos: { id: number; url: string; caption: string | null }[];
  amenities: string[] | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const bookingEngineApi = {
  /** Lightweight status check (dashboard widget). */
  getStatus: () => apiClient.get<BookingEngineStatus>('/booking-engine/status'),

  // ─── Multi-template CRUD ─────────────────────────────────────────────

  /** List all templates for the current org. */
  listConfigs: () => apiClient.get<BookingEngineConfig[]>('/booking-engine/configs'),

  /** List all templates across all orgs (platform staff only). Includes organizationName. */
  listAllConfigs: () => apiClient.get<BookingEngineConfig[]>('/booking-engine/configs/all'),

  /** Get a single template by ID. */
  getConfigById: (id: number) => apiClient.get<BookingEngineConfig>(`/booking-engine/configs/${id}`),

  /** Create a new template. */
  createConfig: (data: BookingEngineConfigUpdate) =>
    apiClient.post<BookingEngineConfig>('/booking-engine/configs', data),

  /** Update an existing template. */
  updateConfig: (id: number, data: BookingEngineConfigUpdate) =>
    apiClient.put<BookingEngineConfig>(`/booking-engine/configs/${id}`, data),

  /** Delete a template. */
  deleteConfig: (id: number) =>
    apiClient.delete(`/booking-engine/configs/${id}`),

  /** Enable or disable a template. */
  toggleEnabled: (id: number, enabled: boolean) =>
    apiClient.put<BookingEngineConfig>(`/booking-engine/configs/${id}/toggle`, { enabled }),

  /** Regenerate API key — old key is immediately invalidated. */
  regenerateApiKey: (id: number) =>
    apiClient.post<BookingEngineConfig>(`/booking-engine/configs/${id}/regenerate-key`),

  // ─── Calendar Availability ──────────────────────────────────────────

  /** Calendrier de disponibilite agrege avec prix min par jour. */
  getCalendarAvailability: (params: {
    from: string;
    to: string;
    types?: string[];
    guests?: number;
  }) =>
    apiClient.get<CalendarAvailabilityResponse>('/booking-engine/calendar/availability', {
      params: {
        from: params.from,
        to: params.to,
        ...(params.types?.length ? { types: params.types.join(',') } : {}),
        ...(params.guests ? { guests: params.guests } : {}),
      },
    }),

  // ─── Guest Auth ──────────────────────────────────────────────────────

  guestRegister: (data: GuestRegisterData) =>
    apiClient.post<GuestAuthResult>('/booking-engine/auth/register', data),

  guestLogin: (data: GuestLoginData) =>
    apiClient.post<GuestAuthResult>('/booking-engine/auth/login', data),

  guestRefreshToken: (data: { refreshToken: string; organizationId: number; keycloakId: string }) =>
    apiClient.post<GuestAuthResult>('/booking-engine/auth/refresh', data),

  guestForgotPassword: (data: { email: string; organizationId: number }) =>
    apiClient.post('/booking-engine/auth/forgot-password', data),

  // ─── Public Availability Check (with server-side tourist tax) ──────

  /** Check availability + get full pricing breakdown (including tourist tax) from the server. */
  checkPropertyAvailability: (slug: string, data: {
    propertyId: number;
    checkIn: string;
    checkOut: string;
    guests: number;
  }) =>
    apiClient.post<{
      available: boolean;
      propertyId: number;
      propertyName: string | null;
      nights: number;
      subtotal: number;
      cleaningFee: number;
      touristTax: number;
      total: number;
      currency: string | null;
      violations: string[];
    }>(`/public/booking/${slug}/availability`, data),

  // ─── Checkout (Stripe) ─────────────────────────────────────────────

  createCheckoutSession: (data: {
    propertyId: number;
    amount: number;
    checkIn: string;
    checkOut: string;
    guests: number;
    customerEmail?: string;
    customerName?: string;
  }) =>
    apiClient.post<{ clientSecret: string; sessionId: string }>('/booking-engine/checkout/create-session', data),

  getCheckoutSessionStatus: (sessionId: string) =>
    apiClient.get<{ status: string; paymentStatus: string }>(`/booking-engine/checkout/session-status/${sessionId}`),

  // ─── Reviews ──────────────────────────────────────────────────────────

  getReviewStats: (propertyId?: number) =>
    apiClient.get<ReviewStats>('/booking-engine/reviews/stats', {
      params: propertyId ? { propertyId } : {},
    }),

  // ─── Public Property Detail ──────────────────────────────────────────

  /** Fetch full property detail for the booking engine (public). */
  getPropertyDetail: (slug: string, propertyId: number) =>
    apiClient.get<PublicPropertyDetail>(`/booking/${slug}/properties/${propertyId}`),

  // ─── Legacy (backward compat) ────────────────────────────────────────

  /** Full config — auto-creates with defaults if none exists. */
  getConfig: () => apiClient.get<BookingEngineConfig>('/booking-engine/config'),

  // ─── AI Design Analysis ────────────────────────────────────────────────

  /** Analyze a website and extract design tokens + generate CSS. */
  analyzeWebsite: (configId: number, websiteUrl: string) =>
    apiClient.post<AiDesignAnalysisResponse>(`/booking-engine/ai/analyze-website/${configId}`, { websiteUrl }),

  /** Regenerate CSS from edited design tokens. */
  generateCss: (configId: number, designTokens: DesignTokens, additionalInstructions?: string) =>
    apiClient.post<AiCssGenerateResponse>(`/booking-engine/ai/generate-css/${configId}`, {
      designTokens,
      additionalInstructions: additionalInstructions || null,
    }),
};
