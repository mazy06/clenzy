// ─── Storage Keys ───────────────────────────────────────────────────────────

/**
 * Anciennes cles de tokens Keycloak — utilisees pour le cleanup au boot
 * uniquement. Les tokens sont desormais portes par un cookie HttpOnly
 * (cf. TokenCookieFilter + AuthSessionController cote backend) + l'instance
 * Keycloak en memoire (keycloak.token).
 *
 * /!\ NE PAS REUTILISER ces cles pour ecrire un token. Respect de
 * CLAUDE.md regle securite #7.
 */
const LEGACY_TOKEN_KEYS = [
  'kc_access_token',
  'kc_refresh_token',
  'kc_id_token',
  'kc_expires_in',
] as const;

export const STORAGE_KEYS = {
  // Auth / Keycloak — DEPRECATED
  // Conservees uniquement pour migration in-flight (TokenService.ts en cours
  // de refactor). A retirer une fois toutes les references nettoyees.
  ACCESS_TOKEN: 'kc_access_token',
  REFRESH_TOKEN: 'kc_refresh_token',
  ID_TOKEN: 'kc_id_token',
  EXPIRES_IN: 'kc_expires_in',

  // App Settings
  SETTINGS: 'clenzy_settings',
  WORKFLOW_SETTINGS: 'workflow-settings',

  // i18n
  LANGUAGE: 'i18nextLng',

  // Currency
  CURRENCY: 'clenzy_currency',

  // Planning mock mode
  PLANNING_MOCK: 'clenzy_planning_mock',

  // Noise monitoring (Minut) mock mode
  NOISE_MONITORING_MOCK: 'clenzy_noise_monitoring_mock',

  // Analytics dashboard mock mode
  ANALYTICS_MOCK: 'clenzy_analytics_mock',

  // Noise devices (configured sensors)
  NOISE_DEVICES: 'clenzy_noise_devices',

  // Smart lock devices (configured locks)
  SMART_LOCK_DEVICES: 'clenzy_smart_lock_devices',

  // Geolocation
  GEO_COUNTRY: 'clenzy_geo_country',
  GEO_APPLIED: 'clenzy_geo_applied',

  // Cross-tab sync
  TOKEN_UPDATE: 'clenzy_token_update',

  // Onboarding checklist dismissed
  ONBOARDING_DISMISSED: 'clenzy_onboarding_dismissed',

  // Contract CTA banner dismissed
  CONTRACT_CTA_DISMISSED: 'clenzy_contract_cta_dismissed',
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
//
// SECURITE (CLAUDE.md regle #7) : les tokens ne sont PLUS stockes dans
// localStorage. La source de verite est :
//   - cookie HttpOnly `clenzy_auth` (cf. TokenCookieFilter + AuthSessionController)
//   - instance Keycloak en memoire (keycloak.token)
//
// Les fonctions ci-dessous sont conservees uniquement pour ne pas casser
// les callers existants pendant la transition (keycloak.ts, TokenService.ts,
// useAuth.ts, etc.). Elles seront supprimees une fois tous les callers
// migres. NE PAS APPELER dans du nouveau code.

/**
 * @deprecated Lire keycloak.token (memoire) au lieu de localStorage.
 * Conservee pour compat — retourne toujours null car le token n'est plus
 * persiste cote client.
 */
export function getAccessToken(): string | null {
  return null;
}

/**
 * @deprecated Le refresh est gere par Keycloak en memoire (keycloak.refreshToken)
 * + cookie HttpOnly cote serveur. Retourne toujours null.
 */
export function getRefreshToken(): string | null {
  return null;
}

/**
 * @deprecated NE PLUS ECRIRE de tokens en localStorage. Le cookie HttpOnly
 * est emis par le backend via Set-Cookie au login. Cette fonction conserve
 * uniquement l'effet de bord `clearMockFlags()` (reset des flags mock au
 * changement de session) pour ne pas casser les callers existants.
 */
export function saveTokens(_tokens: {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: string | number;
}): void {
  // Reinitialiser les flags mock au changement de session
  // pour eviter qu'un non-admin herite du mode mock d'un admin
  clearMockFlags();
  // VOLONTAIREMENT vide : les tokens vivent dans le cookie HttpOnly
  // emis par le backend + l'instance Keycloak en memoire.
}

/**
 * Nettoyage des effets de bord locaux au logout.
 * Le cookie HttpOnly `clenzy_auth` est invalide cote serveur via
 * AuthSessionController#logout. On nettoie ici :
 *  - d'eventuelles cles legacy localStorage (residus de versions anterieures)
 *  - les flags mock (analytics/planning/noise)
 *  - le cookie cross-domain `clenzy_session` (partage avec la landing)
 */
export function clearTokens(): void {
  // Cleanup defensif des anciennes cles localStorage si elles existent
  LEGACY_TOKEN_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // Silent fail
    }
  });
  clearMockFlags();
  clearSessionCookie();
}

/**
 * Nettoyage one-shot au boot pour purger les anciens tokens Keycloak
 * stockes dans localStorage par les versions anterieures (avant la migration
 * vers cookie HttpOnly). A appeler une seule fois au demarrage de l'app
 * depuis `main.tsx` ou equivalent.
 *
 * Operation idempotente — peut etre appelee plusieurs fois sans effet.
 */
export function cleanupLegacyTokens(): void {
  LEGACY_TOKEN_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // Silent fail
    }
  });
}

/**
 * Reinitialise tous les flags de mode mock (analytics, planning, noise).
 * Appele au logout et au login pour eviter que les donnees mock
 * d'un admin soient visibles par un autre utilisateur.
 */
export function clearMockFlags(): void {
  removeItem(STORAGE_KEYS.ANALYTICS_MOCK);
  removeItem(STORAGE_KEYS.PLANNING_MOCK);
  removeItem(STORAGE_KEYS.NOISE_MONITORING_MOCK);
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
 * le flag HttpOnly n'est PAS possible ici (serveur-only). SameSite=Lax
 * (au lieu de Strict) permet au cookie d'etre lu apres une navigation
 * top-level depuis un autre site ou sous-domaine — necessaire pour que
 * la landing (clenzy.fr) detecte la session etablie sur app.clenzy.fr
 * sans forcer un refresh dur. Lax bloque toujours les requetes
 * cross-site non top-level, ce qui couvre le CSRF classique.
 * max-age=28800 (8h) aligne sur la duree de vie typique d'un access token.
 * TODO: Migrer vers un cookie HttpOnly emis par le serveur (AUTH-VULN-02/03).
 */
export function setSessionCookie(accessToken: string): void {
  try {
    const domain = getCookieDomain();
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(accessToken)}; path=/${domain}; max-age=28800; SameSite=Lax${secure}`;
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
  cleanupLegacyTokens,
  clearMockFlags,
  setSessionCookie,
  getSessionCookie,
  clearSessionCookie,
  KEYS: STORAGE_KEYS,
};

export default storageService;
