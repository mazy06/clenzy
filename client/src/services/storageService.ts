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
  KEYS: STORAGE_KEYS,
};

export default storageService;
