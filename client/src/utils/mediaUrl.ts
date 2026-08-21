import { API_CONFIG } from '../config/api';

/**
 * Absolutise une adresse d'image rendue par l'API.
 *
 * <p>Le backend renvoie des chemins relatifs (`/api/issues/12/photos/3/data`).
 * En développement le front est servi par Vite sur un autre port, sans proxy
 * `/api` : un tel chemin viserait Vite et rendrait une image cassée. On le
 * rattache donc explicitement à l'origine de l'API.</p>
 *
 * <p>Les adresses déjà absolues (photos d'OTA, données en base64) passent
 * inchangées.</p>
 */
export function toApiMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_CONFIG.BASE_URL.replace(/\/$/, '')}${url}`;
}
