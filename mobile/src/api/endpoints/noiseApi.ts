import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface DeviceSummary {
  label: string;
  currentLevel: number;
  averageLevel: number;
  maxLevel: number;
}

export interface NoiseChartData {
  devices: DeviceSummary[];
  chartData: Record<string, string | number>[];
}

export interface NoiseDeviceDto {
  id: number;
  deviceType: string;
  name: string;
  propertyId: number;
  propertyName: string;
  roomName: string | null;
  externalDeviceId: string | null;
  status: string;
  createdAt: string;
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

export interface CreateNoiseDeviceRequest {
  deviceType: string;
  name: string;
  propertyId: number;
  roomName?: string;
  externalDeviceId?: string;
  externalHomeId?: string;
}

/* ─── API ─── */

export const noiseApi = {
  /** Get aggregated noise data for all sensors (chart + device summaries) */
  getChartData(params?: { start?: string; end?: string }) {
    return apiClient.get<NoiseChartData>('/noise-devices/data', { params });
  },

  /** Get all noise devices */
  getDevices() {
    return apiClient.get<NoiseDeviceDto[]>('/noise-devices');
  },

  /** Get paginated noise alert history */
  getAlerts(params?: { propertyId?: number; severity?: string; page?: number; size?: number }) {
    return apiClient.get<NoiseAlertPage>('/noise-alerts', { params });
  },

  /** Get count of unacknowledged alerts */
  getUnacknowledgedCount() {
    return apiClient.get<{ count: number }>('/noise-alerts/unacknowledged-count');
  },

  /** Acknowledge an alert */
  acknowledgeAlert(id: number, notes?: string) {
    return apiClient.put<NoiseAlertDto>(`/noise-alerts/${id}/acknowledge`, { notes });
  },

  /** Create a new noise device */
  createDevice(data: CreateNoiseDeviceRequest) {
    return apiClient.post<NoiseDeviceDto>('/noise-devices', data);
  },
};
