import apiClient from '../apiClient';

/**
 * Médiathèque du Studio (2.1). Upload multipart org-scopé ; `url` est l'endpoint public keyless de
 * service du binaire (`/api/public/media/t/{token}`), réutilisable dans les champs image des blocs.
 *
 * Le chemin porte un jeton opaque et non l'identifiant : l'ancienne forme `/api/public/media/{id}`
 * était énumérable par un anonyme (audit sécurité 2026-07-26). Toujours utiliser `url` tel quel,
 * ne jamais reconstruire une URL à partir de `id`.
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
