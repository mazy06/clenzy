import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OnboardingStep {
  key: string;
  completed: boolean;
  completedAt: string | null;
}

export interface OnboardingStatus {
  role: string;
  dismissed: boolean;
  steps: OnboardingStep[];
}

// ─── API ────────────────────────────────────────────────────────────────────

const onboardingApi = {
  getMyStatus: (): Promise<OnboardingStatus> =>
    apiClient.get<OnboardingStatus>('/onboarding/me'),

  completeStep: (stepKey: string): Promise<void> =>
    apiClient.post(`/onboarding/me/steps/${stepKey}/complete`),

  dismiss: (): Promise<void> =>
    apiClient.post('/onboarding/me/dismiss'),

  reset: (): Promise<void> =>
    apiClient.post('/onboarding/me/reset'),
};

export default onboardingApi;
