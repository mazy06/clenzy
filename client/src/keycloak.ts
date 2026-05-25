import Keycloak, { KeycloakTokenParsed } from 'keycloak-js'
import { KEYCLOAK_CONFIG } from './config/api'
import { setSessionCookie, clearSessionCookie, cleanupLegacyTokens } from './services/storageService'

// Singleton Keycloak instance for the whole app
const keycloak = new Keycloak({
  url: KEYCLOAK_CONFIG.URL,
  realm: KEYCLOAK_CONFIG.REALM,
  clientId: KEYCLOAK_CONFIG.CLIENT_ID,
})

// Synchroniser le cookie clenzy_session quand Keycloak rafraichit le token
// en arriere-plan. useAuth.ts pose son propre onAuthSuccess pour la logique
// utilisateur, donc on n'utilise pas onAuthSuccess ici pour eviter le conflit.
keycloak.onAuthRefreshSuccess = () => {
  if (keycloak.token) setSessionCookie(keycloak.token)
}

keycloak.onAuthLogout = () => {
  clearSessionCookie()
}

// Cleanup one-shot des anciens tokens stockes en localStorage par les
// versions anterieures (avant la migration vers cookie HttpOnly). Idempotent.
cleanupLegacyTokens()

// Configuration Keycloak.
// Apres l'init, si l'utilisateur est authentifie (via SSO check ou cookie KC),
// on synchronise le cookie clenzy_session — sans cela, un reload de la page PMS
// restaure la session Keycloak mais ne re-pose pas le cookie partage avec la
// landing, qui pense alors que l'utilisateur n'est pas connecte.
keycloak.init({
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: false,
  enableLogging: true,
  pkceMethod: 'S256'
}).then((authenticated) => {
  if (authenticated && keycloak.token) {
    setSessionCookie(keycloak.token)
  }
}).catch(() => {
  // Silent — l'init peut echouer si Keycloak n'est pas joignable ;
  // l'app gere ce cas via les guards habituels.
})

function decodeJwt(token?: string): KeycloakTokenParsed | undefined {
  if (!token) return undefined
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

/**
 * @deprecated Les tokens ne sont plus persistes cote client. Le backend
 * emet un cookie HttpOnly `clenzy_auth` au login (cf. AuthSessionController).
 * No-op pour ne pas casser les callers existants — a retirer progressivement.
 */
export function saveTokens(_accessToken: string, _refreshToken?: string) {
  // VOLONTAIREMENT vide : cookie HttpOnly cote serveur + keycloak.token en memoire.
}

/**
 * Nettoyage local au logout : purge les eventuelles cles legacy et le cookie
 * cross-domain `clenzy_session`. Le cookie HttpOnly `clenzy_auth` est
 * invalide cote serveur via AuthSessionController#logout.
 */
export function clearTokens() {
  cleanupLegacyTokens()
  clearSessionCookie()
}

/**
 * @deprecated Plus de bootstrap depuis localStorage. La session est restauree
 * via le silent SSO de Keycloak (cf. keycloak.init `onLoad: 'check-sso'`)
 * et le cookie HttpOnly `clenzy_auth` cote serveur.
 *
 * Conservee comme no-op pour ne pas casser les callers existants.
 */
export function bootstrapFromStorage() {
  // VOLONTAIREMENT vide : session restauree via Keycloak SSO + cookie HttpOnly.
}

/**
 * Retourne le token Keycloak en memoire. Source unique de verite cote client.
 * Pour les requetes API, prefere `credentials: 'include'` (cookie HttpOnly
 * automatique via apiClient.ts) plutot que d'injecter ce token manuellement
 * dans un header Authorization.
 */
export function getAccessToken(): string | null {
  return keycloak.token || null
}

export function getParsedAccessToken(): KeycloakTokenParsed | undefined {
  const token = getAccessToken() || undefined
  return decodeJwt(token)
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}

/**
 * Sync the current Keycloak token to the server-side HttpOnly cookie.
 * Called after login, token refresh, and bootstrap from storage.
 * Import syncTokenCookie lazily to avoid circular dependency with apiClient.
 */
export async function syncAuthCookie(): Promise<void> {
  const token = keycloak.token
  if (!token) return
  // Lazy import to avoid circular: keycloak -> apiClient -> keycloak
  const { syncTokenCookie } = await import('./services/apiClient')
  await syncTokenCookie(token)
}

export default keycloak


