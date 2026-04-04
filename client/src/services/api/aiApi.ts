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

  // ── Platform Feature Assignments (SUPER_ADMIN) ──
  getFeatureAssignments: (): Promise<Record<string, PlatformAiModel>> =>
    apiClient.get('/admin/ai/platform-config/features'),

  assignModelToFeature: (feature: string, modelId: number): Promise<{ message: string }> =>
    apiClient.put(`/admin/ai/platform-config/features/${feature}/model/${modelId}`),

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
