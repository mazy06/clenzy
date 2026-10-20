import { API_CONFIG } from '../../../config/api';

/** Resolve admin photo paths against the API, as in the authenticated welcome-guide preview. */
export function baitlyBookingPhotoUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${API_CONFIG.BASE_URL.replace(/\/$/, '')}${url}` : url;
}
