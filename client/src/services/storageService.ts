// ─── Storage Keys ───────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  // Auth / Keycloak
  ACCESS_TOKEN: 'kc_access_token',
  REFRESH_TOKEN: 'kc_refresh_token',
  ID_TOKEN: 'kc_id_token',
  EXPIRES_IN: 'kc_expires_in',

  // App Settings
  SETTINGS: 'clenzy_settings',
  WORKFLOW_SETTINGS: 'workflow-settings',

  // i18n
  LANGUAGE: 'i18nextLng',

  // Planning mock mode
  PLANNING_MOCK: 'clenzy_planning_mock',

  // Noise monitoring (Minut) mock mode
  NOISE_MONITORING_MOCK: 'clenzy_noise_monitoring_mock',

  // Analytics dashboard mock mode
  ANALYTICS_MOCK: 'clenzy_analytics_mock',

  // Noise devices (configured sensors)
  NOISE_DEVICES: 'clenzy_noise_devices',

  // Cross-tab sync
  TOKEN_UPDATE: 'clenzy_token_update',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ─── Core Storage Operations ────────────────────────────────────────────────

/**
 * Get a raw string value from localStorage.
 */
export function getItem(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Set a raw string value in localStorage.
 */
export function setItem(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable – silent fail
  }
}

/**
 * Remove an item from localStorage.
 */
export function removeItem(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silent fail
  }
}

// ─── JSON Helpers ───────────────────────────────────────────────────────────

/**
 * Get a parsed JSON value from localStorage.
 * Returns `null` if key doesn't exist or parsing fails.
 */
export function getJSON<T>(key: StorageKey): T | null {
  const raw = getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Store a value as JSON in localStorage.
 */
export function setJSON<T>(key: StorageKey, value: T): void {
  setItem(key, JSON.stringify(value));
}

// ─── Auth Token Shortcuts ───────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function saveTokens(tokens: {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: string | number;
}): void {
  setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  if (tokens.refreshToken) setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  if (tokens.idToken) setItem(STORAGE_KEYS.ID_TOKEN, tokens.idToken);
  if (tokens.expiresIn !== undefined) setItem(STORAGE_KEYS.EXPIRES_IN, String(tokens.expiresIn));
}

export function clearTokens(): void {
  removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  removeItem(STORAGE_KEYS.ID_TOKEN);
  removeItem(STORAGE_KEYS.EXPIRES_IN);
  // Supprimer aussi le cookie partagé avec la landing page
  clearSessionCookie();
}

// ─── Cross-domain Cookie (shared with landing page) ────────────────────────

const SESSION_COOKIE = 'clenzy_session';

/**
 * Retourne le domaine racine pour le cookie.
 * - localhost → pas de domain (partagé entre tous les ports)
 * - app.clenzy.fr → .clenzy.fr (partagé entre tous les sous-domaines)
 */
function getCookieDomain(): string {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '';
  }
  // Extraire le domaine racine (ex: app.clenzy.fr → .clenzy.fr)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return `; domain=.${parts.slice(-2).join('.')}`;
  }
  return '';
}

/**
 * Save access token as a cookie readable by the landing page.
 * En dev : partagé entre tous les ports de localhost.
 * En prod : partagé entre tous les sous-domaines de clenzy.fr.
 *
 * SECURITE: Ce cookie est cree via document.cookie (client-side), donc
 * le flag HttpOnly n'est PAS possible ici (serveur-only). SameSite=Strict
 * reduit le risque de CSRF. Le max-age est reduit a 1h (au lieu de 24h)
 * pour limiter la fenetre d'attaque en cas de XSS.
 * TODO: Migrer vers un cookie HttpOnly emis par le serveur (AUTH-VULN-02/03).
 */
export function setSessionCookie(accessToken: string): void {
  try {
    const domain = getCookieDomain();
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(accessToken)}; path=/${domain}; max-age=3600; SameSite=Strict${secure}`;
  } catch {
    // Silent fail
  }
}

/**
 * Read the session cookie.
 */
export function getSessionCookie(): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(): void {
  try {
    const domain = getCookieDomain();
    document.cookie = `${SESSION_COOKIE}=; path=/${domain}; max-age=0; SameSite=Lax`;
  } catch {
    // Silent fail
  }
}

// ─── Default Export ─────────────────────────────────────────────────────────

const storageService = {
  getItem,
  setItem,
  removeItem,
  getJSON,
  setJSON,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
  setSessionCookie,
  getSessionCookie,
  clearSessionCookie,
  KEYS: STORAGE_KEYS,
};

export default storageService;
