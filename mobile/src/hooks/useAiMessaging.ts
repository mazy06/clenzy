import { useMutation } from '@tanstack/react-query';
import {
  aiMessagingApi,
  type IntentDetectionResult,
  type SuggestedResponseResult,
} from '@/api/endpoints/aiMessagingApi';

/** Detect intent + urgency + sentiment from a message */
export function useDetectIntent() {
  return useMutation<IntentDetectionResult, Error, string>({
    mutationFn: (message: string) => aiMessagingApi.detectIntent(message),
  });
}

/** Get AI-suggested response for a guest message */
export function useSuggestResponse() {
  return useMutation<SuggestedResponseResult, Error, { message: string; variables?: Record<string, string> }>({
    mutationFn: ({ message, variables }) => aiMessagingApi.suggestResponse(message, variables),
  });
}
