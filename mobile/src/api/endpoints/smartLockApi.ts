import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface SmartLockDeviceDto {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string;
  roomName: string | null;
  externalDeviceId: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  lockState: 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';
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

export interface SmartLockActionResult {
  status: string;
  message: string;
}

/* ─── API ─── */

export const smartLockApi = {
  /** List all smart locks for the current user */
  getAll() {
    return apiClient.get<SmartLockDeviceDto[]>('/smart-locks');
  },

  /** Create a new smart lock device */
  create(data: CreateSmartLockDeviceDto) {
    return apiClient.post<SmartLockDeviceDto>('/smart-locks', data);
  },

  /** Delete a smart lock device */
  delete(id: number) {
    return apiClient.delete<SmartLockActionResult>(`/smart-locks/${id}`);
  },

  /** Get live status for a smart lock */
  getStatus(id: number) {
    return apiClient.get<SmartLockStatusDto>(`/smart-locks/${id}/status`);
  },

  /** Lock a smart lock device */
  lock(id: number) {
    return apiClient.post<SmartLockActionResult>(`/smart-locks/${id}/lock`);
  },

  /** Unlock a smart lock device */
  unlock(id: number) {
    return apiClient.post<SmartLockActionResult>(`/smart-locks/${id}/unlock`);
  },
};
