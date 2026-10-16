import { API_CONFIG } from '@/config/api';
import { useAuthStore } from '@/store/authStore';

/** Resolve API media paths consistently on a physical phone and a simulator. */
export function baitlyMediaUrl(value?: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('data:image/')) return value;
  try {
    const url = new URL(value, API_CONFIG.BASE_URL);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}
export function baitlyMediaList(value: unknown): string[] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value.flatMap(item => typeof item === 'string' && baitlyMediaUrl(item) ? [baitlyMediaUrl(item)!] : []) : [];
}
/** Send a bearer token only to this backend, never to a provider's external image host. */
export function baitlyPrivateImageSource(value:string) {
  const uri=value.startsWith('file://')||value.startsWith('content://')?value:baitlyMediaUrl(value)??'';
  let sameBackend=false;try{sameBackend=new URL(uri).origin===new URL(API_CONFIG.BASE_URL).origin;}catch{/* Local photo or data URI. */}
  const token=useAuthStore.getState().accessToken;
  return sameBackend&&token?{uri,headers:{Authorization:`Bearer ${token}`}}:{uri};
}
