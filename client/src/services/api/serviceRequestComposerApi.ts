import apiClient from '../apiClient';
import type { ServiceRequest } from './serviceRequestsApi';

export interface RequestSelection {
  serviceItemCode: string;
  instructions: string;
  durationHours?: number;
}
export interface RequestDraft {
  submissionId?: string;
  propertyId: number | null;
  desiredDate: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  instructions: string;
  selections: RequestSelection[];
}
export interface RequestEstimate {
  serviceItemCode: string;
  source: 'PLATFORM_GUIDE' | 'ON_QUOTE';
  currency: string | null;
  min: number | null;
  max: number | null;
  durationMinutes: number | null;
}
export const serviceRequestComposerApi = {
  estimate: (draft: RequestDraft) => apiClient.post<RequestEstimate[]>('/service-requests/estimate', draft),
  create: (draft: RequestDraft) => apiClient.post<ServiceRequest[]>('/service-requests/batch', draft),
};
