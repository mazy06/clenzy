import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmartLockDeviceDto {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string;
  roomName: string | null;
  externalDeviceId: string | null;
  status: string;
  lockState: string;
  batteryLevel: number | null;
  createdAt: string;
}

export interface CreateSmartLockDeviceDto {
  name: string;
  propertyId: number;
  roomName?: string;
  externalDeviceId?: string;
}

export interface SmartLockStatusDto {
  locked: boolean;
  batteryLevel: number;
  online: boolean;
}

// ─── Smart Lock API ─────────────────────────────────────────────────────────

export const smartLockApi = {
  /** Liste des serrures connectees de l'utilisateur */
  getAll() {
    return apiClient.get<SmartLockDeviceDto[]>('/smart-locks');
  },

  /** Creer une nouvelle serrure */
  create(data: CreateSmartLockDeviceDto) {
    return apiClient.post<SmartLockDeviceDto>('/smart-locks', data);
  },

  /** Supprimer une serrure */
  delete(id: number) {
    return apiClient.delete(`/smart-locks/${id}`);
  },

  /** Statut live d'une serrure (locked/unlocked, batterie, online) */
  getStatus(id: number) {
    return apiClient.get<SmartLockStatusDto>(`/smart-locks/${id}/status`);
  },

  /** Verrouiller une serrure */
  lock(id: number) {
    return apiClient.post<{ status: string; message: string }>(`/smart-locks/${id}/lock`);
  },

  /** Deverrouiller une serrure */
  unlock(id: number) {
    return apiClient.post<{ status: string; message: string }>(`/smart-locks/${id}/unlock`);
  },
};
