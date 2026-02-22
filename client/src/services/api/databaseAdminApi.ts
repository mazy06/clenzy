import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../storageService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const databaseAdminApi = {
  listBackups(): Promise<BackupInfo[]> {
    return apiClient.get<BackupInfo[]>('/admin/database/backups');
  },

  createBackup(): Promise<BackupInfo> {
    return apiClient.post<BackupInfo>('/admin/database/backups', {});
  },

  downloadBackup(filename: string): void {
    const token = getAccessToken();
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/admin/database/backups/${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    // Use fetch to handle auth header, then download blob
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => {
        console.error('Download backup error:', err);
      });
  },

  deleteBackup(filename: string): Promise<void> {
    return apiClient.delete(`/admin/database/backups/${encodeURIComponent(filename)}`);
  },
};
