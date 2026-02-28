import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface IntentDetectionResult {
  intent: string;
  urgent: boolean;
  sentiment: number;
}

export interface SuggestedResponseResult {
  suggestedResponse: string;
  intent: string;
}

/* ─── API ─── */

export const aiMessagingApi = {
  /** Detect intent, urgency and sentiment from a guest message */
  detectIntent(message: string) {
    return apiClient.post<IntentDetectionResult>('/ai/messaging/detect-intent', { message });
  },

  /** Get AI-suggested response for a guest message */
  suggestResponse(message: string, variables?: Record<string, string>) {
    return apiClient.post<SuggestedResponseResult>('/ai/messaging/suggest-response', {
      message,
      variables: variables ?? {},
    });
  },
};
