import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

// Token Usage — matches AiUsageStatsDto (backend returns Maps, not arrays)
export interface AiUsageStats {
  usageByFeature: Record<string, number>;
  budgetByFeature: Record<string, number>;
  totalUsed: number;
  totalBudget: number;
  monthYear: string;
}

// Breakdown par (provider, model) au sein de chaque feature — matches AiFeatureUsageBreakdownDto.
// Resout l'agregation aveugle : 100k Sonnet ($1.50) et 100k Haiku ($0.10) sont distingues.
export interface AiModelUsage {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  callCount: number;
}

export interface AiUsageBreakdown {
  monthYear: string;
  breakdownByFeature: Record<string, AiModelUsage[]>;
}

// Série temporelle : une ligne = agrégat par (jour, provider, model) — matches DailyUsageDto.
export interface AiDailyUsage {
  date: string; // yyyy-MM-dd
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  calls: number;
  costUsd: number;
}

// Pricing AI
export interface AiPricingRecommendation {
  date: string;
  suggestedPrice: number;
  explanation: string;
  confidence: number;
  marketComparison: string;
  factors: string[];
}

// Messaging AI
export interface AiIntentDetection {
  intent: string;
  confidence: number;
  language: string;
  entities: string[];
  urgent: boolean;
}

export interface AiSuggestedResponse {
  response: string;
  tone: string;
  language: string;
  alternatives: string[];
}

// Analytics AI
export interface AiInsight {
  type: 'ANOMALY' | 'TREND' | 'RECOMMENDATION' | 'WARNING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  recommendation: string;
}

// Sentiment AI
export interface AiSentimentResult {
  score: number;
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  themes: string[];
  actionableInsights: string[];
  suggestedResponse: string;
}

// Feature Toggles
export interface AiFeatureToggle {
  feature: string;
  enabled: boolean;
}

// Key Management (BYOK)
export interface AiApiKeyStatus {
  provider: string;
  configured: boolean;
  maskedApiKey: string | null;
  modelOverride: string | null;
  valid: boolean;
  lastValidatedAt: string | null;
  source: 'PLATFORM' | 'ORGANIZATION';
}

export interface AiApiKeyTestResult {
  success: boolean;
  keyValid: boolean;
  message: string;
  provider: string;
}

export interface SaveAiApiKeyRequest {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  modelOverride?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const aiApi = {
  // ── Token Usage ──
  getUsageStats: (): Promise<AiUsageStats> =>
    apiClient.get('/ai/usage/stats'),

  getUsageBreakdown: (): Promise<AiUsageBreakdown> =>
    apiClient.get('/ai/usage/breakdown'),

  // Série temporelle : conso par (jour, provider, model) — vue « Consommation ».
  getDailyUsage: (days = 30): Promise<AiDailyUsage[]> =>
    apiClient.get(`/ai/usage/daily?days=${days}`),

  // ── Pricing AI ──
  getPricingPredictions: (
    propertyId: number,
    from: string,
    to: string,
  ): Promise<AiPricingRecommendation[]> =>
    apiClient.get(`/ai/pricing/${propertyId}/ai-predictions`, {
      params: { from, to },
    }),

  // ── Messaging AI ──
  detectIntent: (message: string): Promise<AiIntentDetection> =>
    apiClient.post('/ai/messaging/ai-detect-intent', { message }),

  suggestResponse: (
    message: string,
    context?: string,
    language?: string,
  ): Promise<AiSuggestedResponse> =>
    apiClient.post('/ai/messaging/ai-suggest-response', {
      message,
      context,
      language,
    }),

  // ── Analytics AI ──
  getInsights: (
    propertyId: number,
    from: string,
    to: string,
  ): Promise<AiInsight[]> =>
    apiClient.get(`/ai/analytics/${propertyId}/ai-insights`, {
      params: { from, to },
    }),

  // ── Sentiment AI ──
  analyzeSentiment: (
    text: string,
    language?: string,
  ): Promise<AiSentimentResult> =>
    apiClient.post('/ai/sentiment/analyze', { text, language }),

  // ── Feature Toggles ──
  getFeatureToggles: (): Promise<AiFeatureToggle[]> =>
    apiClient.get('/ai/features/toggles'),

  setFeatureToggle: (feature: string, enabled: boolean): Promise<AiFeatureToggle> =>
    apiClient.put('/ai/features/toggles', { feature, enabled }),

  // ── Key Management (BYOK) ──
  getKeyStatus: (): Promise<AiApiKeyStatus[]> =>
    apiClient.get('/ai/keys/status'),

  testKey: (data: SaveAiApiKeyRequest): Promise<AiApiKeyTestResult> =>
    apiClient.post('/ai/keys/test', data),

  saveKey: (data: SaveAiApiKeyRequest): Promise<AiApiKeyStatus> =>
    apiClient.put('/ai/keys', data),

  deleteKey: (provider: string): Promise<{ message: string; provider: string }> =>
    apiClient.delete(`/ai/keys/${provider}`),

  // Catalogue live d'un provider (BYOK org-level) : GET /models avec la clé saisie
  // → liste de modèles réels pour choisir à la connexion (au lieu d'un modèle figé).
  getOrgProviderCatalog: (data: { provider: string; apiKey: string }): Promise<AiCatalogModel[]> =>
    apiClient.post('/ai/keys/catalog', data),

  // ── Platform Models (SUPER_ADMIN) ──
  getPlatformModels: (): Promise<PlatformAiModel[]> =>
    apiClient.get('/admin/ai/platform-config/models'),

  savePlatformModel: (data: SavePlatformModelRequest): Promise<PlatformAiModel> =>
    apiClient.post('/admin/ai/platform-config/models', data),

  updatePlatformModel: (id: number, data: SavePlatformModelRequest): Promise<PlatformAiModel> =>
    apiClient.put(`/admin/ai/platform-config/models/${id}`, data),

  deletePlatformModel: (id: number): Promise<{ message: string }> =>
    apiClient.delete(`/admin/ai/platform-config/models/${id}`),

  testPlatformModel: (data: TestPlatformModelRequest): Promise<{ success: boolean; provider: string; modelId: string }> =>
    apiClient.post('/admin/ai/platform-config/models/test', data),

  // Revérifie la disponibilité d'un modèle (probe à la demande) → modèle à jour.
  recheckPlatformModel: (id: number): Promise<PlatformAiModel> =>
    apiClient.post(`/admin/ai/platform-config/models/${id}/recheck`),

  recheckAllPlatformModels: (): Promise<PlatformAiModel[]> =>
    apiClient.post('/admin/ai/platform-config/models/recheck-all'),

  // Catalogue live d'un provider (GET /models) → IDs + catégorie dérivée.
  getProviderCatalog: (data: { provider: string; apiKey?: string; baseUrl?: string | null }): Promise<AiCatalogModel[]> =>
    apiClient.post('/admin/ai/platform-config/models/catalog', data),

  // ── Platform Feature Assignments (SUPER_ADMIN) ──
  getFeatureAssignments: (): Promise<Record<string, PlatformAiModel>> =>
    apiClient.get('/admin/ai/platform-config/features'),

  assignModelToFeature: (feature: string, modelId: number): Promise<{ message: string }> =>
    apiClient.put(`/admin/ai/platform-config/features/${feature}/model/${modelId}`),

  // Assignations feature → provider connecte (BYOK OpenAI/Anthropic).
  // Retourne une map feature(name) → provider(name). Alternative a un modele plateforme.
  getFeatureProviderAssignments: (): Promise<Record<string, string>> =>
    apiClient.get('/admin/ai/platform-config/features/providers'),

  assignProviderToFeature: (feature: string, provider: string): Promise<{ message: string }> =>
    apiClient.put(`/admin/ai/platform-config/features/${feature}/provider/${provider}`),

  // ── Platform Token Budgets (SUPER_ADMIN) ──
  getFeatureBudgets: (): Promise<Record<string, number>> =>
    apiClient.get('/admin/ai/platform-config/budgets'),

  setFeatureBudget: (feature: string, limit: number): Promise<{ feature: string; limit: number }> =>
    apiClient.put(`/admin/ai/platform-config/budgets/${feature}`, { limit }),

  unassignFeature: (feature: string): Promise<{ message: string }> =>
    apiClient.delete(`/admin/ai/platform-config/features/${feature}`),
};

// ─── Platform AI Model Types ────────────────────────────────────────────────

export interface PlatformAiModel {
  id: number;
  name: string;
  provider: string;
  modelId: string;
  maskedApiKey: string | null;
  baseUrl: string | null;
  assignedFeatures: string[];
  lastValidatedAt: string | null;
  updatedAt: string | null;
  // Disponibilité (probe proactif quotidien + bouton « Revérifier »)
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  lastAvailabilityCheckAt: string | null;
  availabilityError: string | null;
}

/** Entrée du catalogue live d'un provider : ID + catégorie dérivée (chat, code, vision…). */
export interface AiCatalogModel {
  id: string;
  category: string;
}

export interface SavePlatformModelRequest {
  id?: number | null;
  name: string;
  provider: string;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
}

export interface TestPlatformModelRequest {
  provider: string;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
}
