import { API_CONFIG } from '@/config/api';
import { mapScriptJson, type ProviderMapPoint } from './baitlyMapDomain';

/** Le mobile utilise la même surface cartographique déployée avec le PMS. */
export function baitlyProviderMapUrl(language: string, dark: boolean, mode: 'catalog' | 'coverage' = 'catalog'): string {
  const api = new URL(API_CONFIG.BASE_URL);
  const local = __DEV__ && ['localhost', '127.0.0.1', '10.0.2.2', '[::1]'].includes(api.hostname);
  const origin = process.env.EXPO_PUBLIC_MAP_WEB_URL || (local ? `${api.protocol}//${api.host.replace(/:\d+$/, '')}:3000` : 'https://app.baitly.fr');
  const url = new URL('/baitly-provider-map.html', origin);
  url.searchParams.set('lang', language.split('-')[0]);
  url.searchParams.set('theme', dark ? 'dark' : 'light');
  if (mode === 'coverage') url.searchParams.set('surface', 'coverage');
  return url.href;
}

export function baitlyProviderMapPayload(points: ProviderMapPoint[], labels: { map: string; pin: string }, reduced: boolean): string {
  return `window.setBaitlyProviders?.(${mapScriptJson({ points, labels, reduced })});true;`;
}
