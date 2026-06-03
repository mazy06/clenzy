import apiClient from '../apiClient';

// ─── Types (backend /api/thermostats) ────────────────────────────────────────

export interface ThermostatDto {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string | null;
  roomName: string | null;
  brand: string | null;
  status: string;
  online: boolean;
  currentTempC: number | null;
  targetTempC: number | null;
  humidity: number | null;
  /** Mode normalise : heat | cool | eco | off. */
  mode: string | null;
  preset: string | null;
  createdAt: string;
}

export interface CreateThermostatDto {
  name: string;
  propertyId: number;
  roomName?: string;
  brand?: string;
  /** Identifiant du device Tuya (pour lecture/pilotage). */
  externalDeviceId?: string;
}

// ─── Thermostats API ─────────────────────────────────────────────────────────

export const thermostatsApi = {
  getAll() {
    return apiClient.get<ThermostatDto[]>('/thermostats');
  },
  create(data: CreateThermostatDto) {
    return apiClient.post<ThermostatDto>('/thermostats', data);
  },
  delete(id: number) {
    return apiClient.delete(`/thermostats/${id}`);
  },
  /** Statut live (temp/humidite/mode) via Tuya. */
  getStatus(id: number) {
    return apiClient.get<ThermostatDto>(`/thermostats/${id}/status`);
  },
  /** Definit la consigne (°C) via Tuya. */
  setTarget(id: number, targetTempC: number) {
    return apiClient.post<ThermostatDto>(`/thermostats/${id}/target?targetTempC=${targetTempC}`);
  },
};
