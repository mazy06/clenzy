import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface TimeWindowDto {
  id?: number;
  label: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  warningThresholdDb: number; // 30-120
  criticalThresholdDb: number; // 30-120
}

export interface NoiseAlertConfigDto {
  id: number;
  propertyId: number;
  propertyName: string | null;
  enabled: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyGuestMessage: boolean;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  cooldownMinutes: number; // 5-1440
  emailRecipients: string | null;
  timeWindows: TimeWindowDto[];
}

export interface SaveNoiseAlertConfigRequest {
  enabled: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyGuestMessage: boolean;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  cooldownMinutes: number;
  emailRecipients?: string;
  timeWindows: Omit<TimeWindowDto, 'id'>[];
}

/* ─── API ─── */

export const noiseAlertConfigApi = {
  /** List all noise alert configs for the organization */
  getAll() {
    return apiClient.get<NoiseAlertConfigDto[]>('/noise-alert-config');
  },

  /** Get noise alert config for a specific property */
  getByProperty(propertyId: number) {
    return apiClient.get<NoiseAlertConfigDto>(`/noise-alert-config/${propertyId}`);
  },

  /** Create or update noise alert config for a property */
  save(propertyId: number, data: SaveNoiseAlertConfigRequest) {
    return apiClient.put<NoiseAlertConfigDto>(`/noise-alert-config/${propertyId}`, data);
  },

  /** Delete noise alert config for a property */
  delete(propertyId: number) {
    return apiClient.delete(`/noise-alert-config/${propertyId}`);
  },
};
