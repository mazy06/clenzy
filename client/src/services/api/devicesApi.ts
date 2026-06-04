import apiClient from '../apiClient';

// ─── Types (read-model unifié backend) ───────────────────────────────────────

export interface DeviceSummaryDto {
  kind: 'lock' | 'noise' | 'keybox' | 'camera' | 'thermostat';
  id: number;
  name: string;
  propertyId: number | null;
  propertyName: string | null;
  roomName: string | null;
  provider: string;
  status: string;
  lockState: string | null;
  batteryLevel: number | null;
  activeCodesCount: number | null;
  createdAt: string;
}

export interface ProviderStatusDto {
  provider: string;
  connected: boolean;
  deviceCount: number;
  status: string | null;
}

// ─── Devices API (Hub des objets connectés) ──────────────────────────────────

export const devicesApi = {
  /** Read-model unifié : serrures + capteurs sonores + points de remise des clés. */
  getAll() {
    return apiClient.get<DeviceSummaryDto[]>('/devices');
  },

  /** Statut de connexion par provider (Minut/Tuya/Nuki réel, KeyNest présence). */
  getProviders() {
    return apiClient.get<ProviderStatusDto[]>('/devices/providers');
  },
};
