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
  // Book Direct & Save (2.8) : remise % réservation directe (1–100 ; null/0 = aucune)
  directBookingDiscountPercent: number | null;
  // Tarif membre (2.8) : remise % voyageur connecté (le membre obtient max(directe, membre))
  memberDiscountPercent: number | null;
  // Durée du hold PENDING avant annulation auto (minutes ; null = défaut système 30)
  pendingHoldMinutes: number | null;
  // Custom CSS/JS + Component Config
  customCss: string | null;
  customJs: string | null;
  componentConfig: string | null;
  // Site builder (page composée par blocs, JSON)
  pageLayout: string | null;
  // Propriétés affichées (curation) : IDs en CSV ; null/vide = toutes
  featuredPropertyIds: string | null;
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

// ─── Catalogue de templates de site ───────────────────────────────────────────

/** Template de site (galerie « Choisir un design »). scope GLOBAL = catalogue Clenzy ; ORG = privé. */
export interface SiteTemplateDto {
  id: number;
  name: string;
  description: string | null;
  register: string | null;
  previewUrl: string | null;
  contentJson: string;
  scope: 'GLOBAL' | 'ORG';
  organizationId: number | null;
  createdAt: string;
}

export interface SiteTemplateCreateRequest {
  name: string;
  description?: string;
  register?: string;
  previewUrl?: string;
  contentJson: string;
  scope: 'GLOBAL' | 'ORG';
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

  // ─── Catalogue de templates de site (global Clenzy + privés par org) ──

  /** Templates visibles : catalogue global Clenzy + ceux de l'org courante. */
  listSiteTemplates: () => apiClient.get<SiteTemplateDto[]>('/booking-engine/site-templates'),

  /** Enregistre le design courant comme template (scope ORG, ou GLOBAL pour le staff plateforme). */
  createSiteTemplate: (data: SiteTemplateCreateRequest) =>
    apiClient.post<SiteTemplateDto>('/booking-engine/site-templates', data),

  /** Modifie un template (métadonnées ; le contenu n'est remplacé que si `contentJson` est fourni). */
  updateSiteTemplate: (id: number, data: Partial<SiteTemplateCreateRequest>) =>
    apiClient.put<SiteTemplateDto>(`/booking-engine/site-templates/${id}`, data),

  /** Supprime un template (global = staff plateforme ; privé = org propriétaire). */
  deleteSiteTemplate: (id: number) =>
    apiClient.delete(`/booking-engine/site-templates/${id}`),

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

  /**
   * Admin variant: check availability + full pricing breakdown without needing
   * the org slug. Resolves the org via the authenticated user's TenantContext.
   *
   * Used by the booking engine preview in the PMS to compute the real tourist tax
   * (vs the public widget which uses the slug-based endpoint above).
   */
  checkPropertyAvailabilityAdmin: (data: {
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
    }>('/booking-engine/calendar/availability-check', data),

  // ─── Checkout (Stripe) ─────────────────────────────────────────────

  createCheckoutSession: (data: {
    propertyId: number;
    /** Requis côté serveur (@NotNull) : cross-check anti cross-tenant. */
    organizationId: number;
    /**
     * Montant attendu côté client — simple cross-check : le serveur recalcule
     * TOUJOURS le devis (PriceEngine) et rejette en 400 toute divergence.
     * Doit provenir du total de l'API availability, jamais d'un calcul local.
     */
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
