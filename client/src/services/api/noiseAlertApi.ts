import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimeWindowDto {
  id: number | null;
  label: string;
  startTime: string;
  endTime: string;
  warningThresholdDb: number;
  criticalThresholdDb: number;
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
  cooldownMinutes: number;
  emailRecipients: string | null;
  timeWindows: TimeWindowDto[];
}

export interface SaveNoiseAlertConfigDto {
  enabled: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyGuestMessage: boolean;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  cooldownMinutes: number;
  emailRecipients: string | null;
  timeWindows: {
    label: string;
    startTime: string;
    endTime: string;
    warningThresholdDb: number;
    criticalThresholdDb: number;
  }[];
}

export interface NoiseAlertDto {
  id: number;
  propertyId: number;
  propertyName: string | null;
  deviceId: number | null;
  deviceName: string | null;
  severity: 'WARNING' | 'CRITICAL';
  measuredDb: number;
  thresholdDb: number;
  timeWindowLabel: string | null;
  source: 'WEBHOOK' | 'SCHEDULER' | 'MANUAL';
  notifiedInApp: boolean;
  notifiedEmail: boolean;
  notifiedGuest: boolean;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface NoiseAlertPage {
  content: NoiseAlertDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ─── Config API ──────────────────────────────────────────────────────────────

export const noiseAlertConfigApi = {
  getAll() {
    return apiClient.get<NoiseAlertConfigDto[]>('/noise-alert-config');
  },

  getByProperty(propertyId: number) {
    return apiClient.get<NoiseAlertConfigDto>(`/noise-alert-config/${propertyId}`);
  },

  save(propertyId: number, data: SaveNoiseAlertConfigDto) {
    return apiClient.put<NoiseAlertConfigDto>(`/noise-alert-config/${propertyId}`, data);
  },

  delete(propertyId: number) {
    return apiClient.delete(`/noise-alert-config/${propertyId}`);
  },
};

// ─── Alerts API ──────────────────────────────────────────────────────────────

export const noiseAlertsApi = {
  getAlerts(params?: { propertyId?: number; severity?: string; page?: number; size?: number }) {
    return apiClient.get<NoiseAlertPage>('/noise-alerts', { params });
  },

  getUnacknowledgedCount() {
    return apiClient.get<{ count: number }>('/noise-alerts/unacknowledged-count');
  },

  acknowledge(id: number, notes?: string) {
    return apiClient.put<NoiseAlertDto>(`/noise-alerts/${id}/acknowledge`, { notes });
  },
};
