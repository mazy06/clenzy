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
}

/** Update payload — excludes id, orgId, apiKey, enabled (managed via dedicated endpoints). */
export type BookingEngineConfigUpdate = Omit<BookingEngineConfig, 'id' | 'organizationId' | 'apiKey' | 'enabled'>;

// ─── API ─────────────────────────────────────────────────────────────────────

export const bookingEngineApi = {
  /** Lightweight status check (dashboard widget). */
  getStatus: () => apiClient.get<BookingEngineStatus>('/booking-engine/status'),

  // ─── Multi-template CRUD ─────────────────────────────────────────────

  /** List all templates for the current org. */
  listConfigs: () => apiClient.get<BookingEngineConfig[]>('/booking-engine/configs'),

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
