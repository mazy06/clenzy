import apiClient from '../apiClient';

/**
 * Médiathèque du Studio (2.1). Upload multipart org-scopé ; `url` est l'endpoint public keyless de
 * service du binaire (`/api/public/media/{id}`), réutilisable dans les champs image des blocs.
 */
export interface MediaAsset {
  id: number;
  url: string;
  fileName: string | null;
  contentType: string;
  fileSize: number;
  createdAt: string;
}

const BASE = '/booking-engine/media';

export const mediaApi = {
  list: (): Promise<MediaAsset[]> => apiClient.get<MediaAsset[]>(BASE),

  upload: (file: File): Promise<MediaAsset> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<MediaAsset>(BASE, formData);
  },

  remove: (id: number): Promise<void> => apiClient.delete(`${BASE}/${id}`),
};
