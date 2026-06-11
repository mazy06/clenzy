// ─── Storage Keys ───────────────────────────────────────────────────────────

/**
 * Anciennes cles de tokens Keycloak — utilisees pour le cleanup au boot
 * uniquement. Les tokens sont desormais portes par un cookie HttpOnly
 * (cf. TokenCookieFilter + AuthSessionController cote backend) + l'instance
 * Keycloak en memoire (keycloak.token).
 *
 * /!\ NE PAS REUTILISER ces cles pour ecrire un token. Respect de
 * CLAUDE.md regle securite #7.
 *
 * `kc_expires_in` est volontairement inclus pour le cleanup boot bien
 * qu'il ne soit plus reference par {@link STORAGE_KEYS} : on purge tous
 * les residus possibles.
 */
const LEGACY_TOKEN_KEYS = [
  'kc_access_token',
  'kc_refresh_token',
  'kc_id_token',
  'kc_expires_in',
] as const;

export const STORAGE_KEYS = {
  // App Settings (per-device UI : compactMode, showAvatars, theme)
  SETTINGS: 'clenzy_settings',

  // i18n (per-device, gere par i18next LanguageDetector)
  LANGUAGE: 'i18nextLng',

  // Currency d'affichage (per-device)
  CURRENCY: 'clenzy_currency',

  // Mocks dev/demo — utiliser isMockEnabled() / setMockEnabled() au lieu
  // de lire/ecrire ces cles directement.
  PLANNING_MOCK: 'clenzy_planning_mock',
  NOISE_MONITORING_MOCK: 'clenzy_noise_monitoring_mock',
  ANALYTICS_MOCK: 'clenzy_analytics_mock',

  // Cache backend (source de verite = serveur, fallback offline local)
  NOISE_DEVICES: 'clenzy_noise_devices',
  SMART_LOCK_DEVICES: 'clenzy_smart_lock_devices',

  // Geolocation one-shot (detection IP au 1er login)
  GEO_COUNTRY: 'clenzy_geo_country',
  GEO_APPLIED: 'clenzy_geo_applied',

  // Canal de communication cross-tabs pour la synchro des sessions
  // (cf. TokenService.notifyOtherTabs — pas un "stockage" de pref)
  TOKEN_UPDATE: 'clenzy_token_update',

  // Contract CTA banner dismissed (per-device)
  CONTRACT_CTA_DISMISSED: 'clenzy_contract_cta_dismissed',

  // Teinte d'accent Signature (per-device, anti-FOUC — lecture synchrone au
  // boot comme clenzy_theme_mode). Utiliser les helpers de theme/signature/accent.ts,
  // jamais lire/ecrire cette cle directement.
  ACCENT: 'clenzy_accent',
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

// ─── Auth session cleanup ───────────────────────────────────────────────────
//
// SECURITE (CLAUDE.md regle #7) : les tokens ne sont PLUS stockes dans
// localStorage. La source de verite est :
//   - cookie HttpOnly `clenzy_auth` (cf. TokenCookieFilter + AuthSessionController)
//   - instance Keycloak en memoire (keycloak.token)
//
// Les helpers d'auth historiques (getAccessToken, getRefreshToken, saveTokens,
// bootstrapFromStorage) ont ete supprimes : tous les callers sont passes par
// keycloak.token (memoire) ou par le cookie HttpOnly via `credentials: 'include'`.

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

// ─── Mock Flags (dev/demo) ──────────────────────────────────────────────────
//
// Centralisation des flags mock dispersés dans plusieurs api/ files. Les
// callers doivent utiliser ces helpers plutot que de lire/ecrire la cle
// localStorage en direct (eviter les `localStorage.getItem('clenzy_*_mock')`
// dupliques avec leur propre constante).

/** Noms identifiants des modes mock disponibles. */
export type MockFlag = 'analytics' | 'planning' | 'noiseMonitoring';

const MOCK_FLAG_KEYS: Record<MockFlag, StorageKey> = {
  analytics: STORAGE_KEYS.ANALYTICS_MOCK,
  planning: STORAGE_KEYS.PLANNING_MOCK,
  noiseMonitoring: STORAGE_KEYS.NOISE_MONITORING_MOCK,
};

/** Retourne `true` si le mode mock est actif pour le flag donne. */
export function isMockEnabled(flag: MockFlag): boolean {
  return getItem(MOCK_FLAG_KEYS[flag]) === 'true';
}

/** Active ou desactive le mode mock pour le flag donne. */
export function setMockEnabled(flag: MockFlag, enabled: boolean): void {
  setItem(MOCK_FLAG_KEYS[flag], enabled ? 'true' : 'false');
}

// ─── Cross-domain Cookie (shared with landing page) ────────────────────────

const SESSION_COOKIE = 'clenzy_session';

/**
 * Valeur opaque du cookie cross-domain. La landing (clenzy.fr) n'a besoin
 * que de DETECTER la presence d'une session sur app.clenzy.fr — jamais du
 * token lui-meme. Z1-SEC-FRONTAUX-01 : on ne stocke PLUS le JWT brut dans
 * ce cookie non-HttpOnly (lisible par JS sur tous les sous-domaines).
 */
const SESSION_COOKIE_VALUE = 'authenticated';

/** TTL de repli si le token est illisible (1h = TTL typique d'un access token Keycloak). */
const SESSION_COOKIE_FALLBACK_MAX_AGE_SECONDS = 3600;

/** Borne haute de securite pour le max-age du cookie (8h). */
const SESSION_COOKIE_MAX_AGE_CAP_SECONDS = 28800;

/**
 * Calcule le max-age du cookie a partir du claim `exp` du JWT, borne entre
 * 0 et {@link SESSION_COOKIE_MAX_AGE_CAP_SECONDS}. Le token n'est PAS stocke,
 * il sert uniquement a aligner la duree de vie du cookie sur la session reelle.
 */
function getTokenRemainingSeconds(accessToken: string): number {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return SESSION_COOKIE_FALLBACK_MAX_AGE_SECONDS;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (typeof payload.exp !== 'number') return SESSION_COOKIE_FALLBACK_MAX_AGE_SECONDS;
    const remaining = Math.floor(payload.exp - Date.now() / 1000);
    return Math.min(Math.max(remaining, 0), SESSION_COOKIE_MAX_AGE_CAP_SECONDS);
  } catch {
    return SESSION_COOKIE_FALLBACK_MAX_AGE_SECONDS;
  }
}

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
 * Pose le marqueur de session cross-domain lisible par la landing.
 * En dev : partagé entre tous les ports de localhost.
 * En prod : partagé entre tous les sous-domaines de clenzy.fr.
 *
 * SECURITE (Z1-SEC-FRONTAUX-01) : ce cookie ne contient PLUS le JWT —
 * seulement le marqueur opaque {@link SESSION_COOKIE_VALUE}. Le token recu
 * en parametre sert uniquement a aligner le max-age du cookie sur
 * l'expiration reelle de la session (claim `exp`). Une XSS sur un
 * sous-domaine ne peut donc plus exfiltrer de credential via ce cookie.
 *
 * Ce cookie est cree via document.cookie (client-side), donc le flag
 * HttpOnly n'est PAS possible ici (serveur-only). SameSite=Lax (au lieu
 * de Strict) permet au cookie d'etre lu apres une navigation top-level
 * depuis un autre site ou sous-domaine — necessaire pour que la landing
 * (clenzy.fr) detecte la session etablie sur app.clenzy.fr sans forcer
 * un refresh dur. Lax bloque toujours les requetes cross-site non
 * top-level, ce qui couvre le CSRF classique.
 * TODO: Migrer vers un cookie HttpOnly emis par le serveur (AUTH-VULN-02/03).
 */
export function setSessionCookie(accessToken: string): void {
  try {
    writeSessionMarkerCookie(getTokenRemainingSeconds(accessToken));
  } catch {
    // Silent fail
  }
}

/**
 * Variante de {@link setSessionCookie} quand le token brut n'est pas
 * disponible cote JS (session restauree via les metadonnees du cookie
 * HttpOnly — Z1-SEC-FRONTAUX-02) : le max-age est cale directement sur
 * l'expiration de session fournie par le backend (claim `exp`).
 */
export function setSessionCookieUntil(expiresAtEpochSeconds: number): void {
  try {
    const remaining = Math.floor(expiresAtEpochSeconds - Date.now() / 1000);
    writeSessionMarkerCookie(Math.min(Math.max(remaining, 0), SESSION_COOKIE_MAX_AGE_CAP_SECONDS));
  } catch {
    // Silent fail
  }
}

function writeSessionMarkerCookie(maxAge: number): void {
  if (maxAge <= 0) {
    clearSessionCookie();
    return;
  }
  const domain = getCookieDomain();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE}=${SESSION_COOKIE_VALUE}; path=/${domain}; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * Read the session cookie marker. Retourne la valeur opaque
 * ({@link SESSION_COOKIE_VALUE}) si une session est signalee, sinon null.
 * Ne contient jamais de token.
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
  clearTokens,
  cleanupLegacyTokens,
  clearMockFlags,
  isMockEnabled,
  setMockEnabled,
  setSessionCookie,
  setSessionCookieUntil,
  getSessionCookie,
  clearSessionCookie,
  KEYS: STORAGE_KEYS,
};

export default storageService;
