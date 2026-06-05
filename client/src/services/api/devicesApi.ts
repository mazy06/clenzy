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
  /** Connectivité réelle : serrures = vrai flag Tuya, autres types = status===ACTIVE. null = jamais synchronisé. */
  online: boolean | null;
  lockState: string | null;
  batteryLevel: number | null;
  activeCodesCount: number | null;
  /** Caméras : URL du poster (snapshot du flux). Null pour les autres types. */
  snapshotUrl: string | null;
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
