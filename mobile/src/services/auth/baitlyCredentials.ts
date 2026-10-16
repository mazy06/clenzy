import { API_CONFIG } from '@/config/api';

export type LoginFailure = 'credentials' | 'locked' | 'captcha' | 'network' | 'profile';
export class BaitlyLoginError extends Error {
  constructor(public readonly reason: LoginFailure) { super(reason); }
}

export async function nativeAuthRequest(path: string, body: object) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal, credentials: 'omit',
    });
  } catch { throw new BaitlyLoginError('network'); }
  finally { clearTimeout(timeout); }
}

export async function baitlyCredentials(username: string, password: string, captchaToken?: string) {
  const response = await nativeAuthRequest(API_CONFIG.ENDPOINTS.LOGIN, { username: username.trim(), password, ...(captchaToken ? { captchaToken } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BaitlyLoginError(response.status === 429 || data.accountLocked ? 'locked'
      : data.captchaRequired || data.error === 'captcha_invalid' ? 'captcha' : response.status >= 500 ? 'network' : 'credentials');
  }
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') throw new BaitlyLoginError('network');
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}
