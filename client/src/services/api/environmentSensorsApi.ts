import apiClient from '../apiClient';

// ─── Types (backend /api/environment-sensors) ────────────────────────────────

export type SensorType = 'TEMP_HUMIDITY' | 'CONTACT' | 'MOTION' | 'SMOKE';

export interface EnvironmentSensorDto {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string | null;
  roomName: string | null;
  sensorType: SensorType;
  brand: string | null;
  status: string;
  /** Tri-état : null = jamais synchronisé. */
  online: boolean | null;
  batteryLevel: number | null;
  /** TEMP_HUMIDITY */
  temperatureC: number | null;
  humidity: number | null;
  /** CONTACT : true = ouvert. */
  contactOpen: boolean | null;
  /** MOTION */
  motionDetected: boolean | null;
  /** SMOKE */
  smokeDetected: boolean | null;
  lastSeenAt: string | null;
  lastEventAt: string | null;
  createdAt: string;
}

export interface CreateEnvironmentSensorDto {
  name: string;
  propertyId: number;
  roomName?: string;
  sensorType: SensorType;
  brand?: string;
  /** Identifiant du device Tuya (pour la lecture d'état). */
  externalDeviceId?: string;
}

// ─── Environment Sensors API ──────────────────────────────────────────────────

export const environmentSensorsApi = {
  getAll() {
    return apiClient.get<EnvironmentSensorDto[]>('/environment-sensors');
  },
  create(data: CreateEnvironmentSensorDto) {
    return apiClient.post<EnvironmentSensorDto>('/environment-sensors', data);
  },
  delete(id: number) {
    return apiClient.delete(`/environment-sensors/${id}`);
  },
  /** Rafraîchit l'état du capteur via Tuya. */
  refresh(id: number) {
    return apiClient.post<EnvironmentSensorDto>(`/environment-sensors/${id}/refresh`);
  },
};
