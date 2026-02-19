import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface CreateNoiseDeviceDto {
  deviceType: string;
  name: string;
  propertyId: number;
  roomName?: string;
  externalDeviceId?: string;
  externalHomeId?: string;
}

export interface NoiseDataPointDto {
  time: string;
  decibels: number;
  deviceLabel: string;
}

export interface DeviceSummary {
  label: string;
  currentLevel: number;
  averageLevel: number;
  maxLevel: number;
}

export interface NoiseChartDataDto {
  devices: DeviceSummary[];
  chartData: Record<string, string | number>[];
}

export interface MinutConnectionStatus {
  connected: boolean;
  status: string;
  minutUserId: string | null;
  organizationId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
  deviceCount: number;
}

export interface TuyaConnectionStatus {
  connected: boolean;
  status: string;
  tuyaUid: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
  deviceCount: number;
}

// ─── Noise Devices API ───────────────────────────────────────────────────────

export const noiseDevicesApi = {
  /** Liste des capteurs de bruit de l'utilisateur */
  getAll() {
    return apiClient.get<NoiseDeviceDto[]>('/noise-devices');
  },

  /** Creer un nouveau capteur */
  create(data: CreateNoiseDeviceDto) {
    return apiClient.post<NoiseDeviceDto>('/noise-devices', data);
  },

  /** Supprimer un capteur */
  delete(id: number) {
    return apiClient.delete(`/noise-devices/${id}`);
  },

  /** Donnees bruit d'un capteur specifique */
  getNoiseData(id: number, params?: { start?: string; end?: string }) {
    return apiClient.get<NoiseDataPointDto[]>(`/noise-devices/${id}/data`, { params });
  },

  /** Donnees bruit agregees de tous les capteurs */
  getAllNoiseData(params?: { start?: string; end?: string }) {
    return apiClient.get<NoiseChartDataDto>('/noise-devices/data', { params });
  },
};

// ─── Minut API ───────────────────────────────────────────────────────────────

export const minutApi = {
  /** Initier la connexion OAuth Minut */
  connect() {
    return apiClient.get<{ authorization_url?: string; status: string; message?: string }>(
      '/minut/connect',
    );
  },

  /** Deconnecter le compte Minut */
  disconnect() {
    return apiClient.post<{ status: string; message: string }>('/minut/disconnect');
  },

  /** Statut de la connexion Minut */
  getStatus() {
    return apiClient.get<MinutConnectionStatus>('/minut/status');
  },

  /** Details d'un device Minut */
  getDevice(deviceId: string) {
    return apiClient.get<Record<string, unknown>>(`/minut/devices/${deviceId}`);
  },

  /** Details d'un home Minut */
  getHome(homeId: string) {
    return apiClient.get<Record<string, unknown>>(`/minut/homes/${homeId}`);
  },

  /** Evenements d'un home Minut */
  getHomeEvents(
    homeId: string,
    params?: { startAt?: string; endAt?: string; eventTypes?: string },
  ) {
    return apiClient.get<Record<string, unknown>>(`/minut/homes/${homeId}/events`, { params });
  },

  /** Configuration monitoring bruit */
  getDisturbanceConfig(homeId: string) {
    return apiClient.get<Record<string, unknown>>(`/minut/homes/${homeId}/disturbance`);
  },

  /** Mettre a jour la config monitoring bruit */
  updateDisturbanceConfig(homeId: string, config: Record<string, unknown>) {
    return apiClient.put<Record<string, unknown>>(`/minut/homes/${homeId}/disturbance`, config);
  },
};

// ─── Tuya API ────────────────────────────────────────────────────────────────

export const tuyaApi = {
  /** Configurer la connexion Tuya */
  connect() {
    return apiClient.post<{ status: string; message: string; tuya_uid?: string }>(
      '/tuya/connect',
    );
  },

  /** Deconnecter le compte Tuya */
  disconnect() {
    return apiClient.post<{ status: string; message: string }>('/tuya/disconnect');
  },

  /** Statut de la connexion Tuya */
  getStatus() {
    return apiClient.get<TuyaConnectionStatus>('/tuya/status');
  },

  /** Infos d'un device Tuya */
  getDeviceInfo(deviceId: string) {
    return apiClient.get<Record<string, unknown>>(`/tuya/devices/${deviceId}`);
  },

  /** Data points actuels d'un device Tuya */
  getDeviceStatus(deviceId: string) {
    return apiClient.get<Record<string, unknown>>(`/tuya/devices/${deviceId}/status`);
  },

  /** Historique data points d'un device Tuya */
  getDeviceLogs(deviceId: string, params: { startTime: number; endTime: number }) {
    return apiClient.get<Record<string, unknown>>(`/tuya/devices/${deviceId}/logs`, { params });
  },
};
