import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyPhotoDto {
  id: number;
  propertyId: number;
  originalFilename: string | null;
  contentType: string;
  fileSize: number;
  sortOrder: number;
  caption: string | null;
  source: string | null;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildUrl(propertyId: number, path = ''): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/properties/${propertyId}/photos${path}`;
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── API ────────────────────────────────────────────────────────────────────

export const propertyPhotosApi = {

  /** List all photos (metadata only, no binary) */
  async list(propertyId: number): Promise<PropertyPhotoDto[]> {
    const response = await fetch(buildUrl(propertyId), {
      headers: authHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return response.json();
  },

  /** Upload a photo (multipart/form-data) */
  async upload(propertyId: number, file: File, caption?: string): Promise<PropertyPhotoDto> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);

    const response = await fetch(buildUrl(propertyId), {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return response.json();
  },

  /** Get the binary URL for a photo (for <img src>) */
  getPhotoUrl(propertyId: number, photoId: number): string {
    return buildUrl(propertyId, `/${photoId}/data`);
  },

  /** Delete a photo */
  async delete(propertyId: number, photoId: number): Promise<void> {
    const response = await fetch(buildUrl(propertyId, `/${photoId}`), {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
  },

  /** Reorder photos */
  async reorder(propertyId: number, photoIds: number[]): Promise<void> {
    const response = await fetch(buildUrl(propertyId, '/reorder'), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(photoIds),
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
  },
};
