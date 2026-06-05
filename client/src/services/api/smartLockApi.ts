import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SmartLockBrand = 'TUYA' | 'NUKI' | 'TTLOCK' | 'YALE';

export interface SmartLockDeviceDto {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string;
  roomName: string | null;
  externalDeviceId: string | null;
  brand: SmartLockBrand;
  status: string;
  lockState: string;
  batteryLevel: number | null;
  /** Connectivité réelle (vrai flag Tuya). null = jamais synchronisé. */
  online: boolean | null;
  createdAt: string;
}

export interface CreateSmartLockDeviceDto {
  name: string;
  propertyId: number;
  roomName?: string;
  externalDeviceId?: string;
  brand?: SmartLockBrand;
}

export interface SmartLockStatusDto {
  locked: boolean;
  batteryLevel: number;
  online: boolean;
}

export interface SmartLockAccessCodeDto {
  id: number;
  deviceId: number;
  reservationId: number | null;
  /** PIN — visible seulement pour les rôles autorisés (endpoint role-gate). */
  code: string | null;
  name: string | null;
  validFrom: string | null;
  validUntil: string | null;
  status: string;
  source: string;
  createdAt: string;
}

export interface RotateAccessCodeRequest {
  validFrom?: string;
  validUntil?: string;
  reservationId?: number;
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

  /** Code d'accès courant d'une serrure (corps vide si aucun — 204). */
  getAccessCode(id: number) {
    return apiClient.get<SmartLockAccessCodeDto | ''>(`/smart-locks/${id}/access-code`);
  },

  /** Régénère / change le code d'accès (révoque l'actif + en génère un nouveau, déclenche un event). */
  rotateAccessCode(id: number, body?: RotateAccessCodeRequest) {
    return apiClient.post<SmartLockAccessCodeDto>(`/smart-locks/${id}/access-code/rotate`, body ?? {});
  },

  /** Révoque le code d'accès courant. */
  revokeAccessCode(id: number) {
    return apiClient.delete(`/smart-locks/${id}/access-code`);
  },
};
