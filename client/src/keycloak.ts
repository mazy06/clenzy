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
//
// IMPORTANT — restauration du token depuis le cookie HttpOnly au boot :
// Le check-sso Keycloak (iframe silent) est fragile en localhost (ports
// differents = cross-site, cookies Keycloak SameSite=Lax pas envoyes) et
// en prod avec Safari ITP. Resultat : meme si l'user a un cookie HttpOnly
// `clenzy_auth` valide cote backend, keycloak.init() retourne `authenticated=false`
// → l'app deconnecte l'user au hard refresh.
//
// Fix : AVANT keycloak.init(), on appelle GET /api/auth/session avec le
// cookie HttpOnly. Si le backend retourne un token valide (Spring Security
// + TokenCookieFilter valident le cookie), on pre-rempli keycloak.token et
// on init avec ce token directement. Sinon, fallback sur check-sso normal.
//
// Ce qu'on appelle ici DOIT etre une fonction asynchrone — d'ou le wrap
// dans une IIFE async. La promise resultante est exportee pour que App.tsx
// puisse l'await avant toute decision auth (cf. useEffect d'init App).
export const keycloakInitPromise: Promise<boolean> = (async () => {
  // Step 1 : tenter de recuperer le token depuis le cookie HttpOnly via backend.
  // Si reussi → l'user est encore authentifie, on a son token valide.
  let bootstrapToken: string | undefined
  try {
    const { API_CONFIG } = await import('./config/api')
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/auth/session`, {
      method: 'GET',
      credentials: 'include', // Envoyer le cookie HttpOnly clenzy_auth
    })
    if (response.ok) {
      const data = await response.json() as { token?: string }
      if (data.token) {
        bootstrapToken = data.token
      }
    }
  } catch {
    // Silent — backend pas joignable ou pas de cookie → on tombera sur check-sso
  }

  // Step 2 : init Keycloak avec check-sso classique. On NE passe PAS le
  // bootstrapToken a init() directement : Keycloak JS valide l'issuer du
  // token contre son URL configuree, et en dev il y a un mismatch :
  //   - Token issuer : http://clenzy-keycloak:8080 (URL Docker interne, utilisee
  //     par le backend pour valider les JWT)
  //   - Frontend Keycloak URL : http://localhost:8083 (URL browser exposee)
  // Donc init({token}) rejette le token avec "issuer mismatch".
  //
  // Strategie : on tente check-sso normal (qui ne valide rien cote client).
  // Si Keycloak retourne authenticated=true (cookies Keycloak natifs OK) → fin.
  // Sinon mais on a bootstrapToken valide cote backend → on force-set keycloak
  // manuellement (bypass de la validation issuer).
  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      checkLoginIframe: false,
      enableLogging: true,
      pkceMethod: 'S256',
    })

    if (authenticated && keycloak.token) {
      setSessionCookie(keycloak.token)
      return true
    }

    // Fallback : check-sso a echoue (cookies Keycloak natifs absents ou
    // hostname mismatch), mais le backend a confirme la session via le
    // cookie HttpOnly clenzy_auth (bootstrapToken). On force-set manuellement.
    if (bootstrapToken) {
      keycloak.token = bootstrapToken
      keycloak.authenticated = true
      keycloak.tokenParsed = decodeJwt(bootstrapToken)
      // Note : on n'a pas le refreshToken (le cookie ne contient que le access
      // token). Le user devra se re-login quand le token expire (~1h). Pour
      // un refresh automatique, il faudrait que le backend stocke aussi le
      // refresh token (TODO suivi).
      setSessionCookie(bootstrapToken)
      return true
    }

    return false
  } catch {
    // Silent — l'init peut echouer si Keycloak n'est pas joignable ;
    // l'app gere ce cas via les guards habituels.
    if (bootstrapToken) {
      // Meme en cas d'erreur init, si on a un token backend valide, on l'utilise
      keycloak.token = bootstrapToken
      keycloak.authenticated = true
      keycloak.tokenParsed = decodeJwt(bootstrapToken)
      setSessionCookie(bootstrapToken)
      return true
    }
    return false
  }
})()

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
 * Nettoyage local au logout : purge les eventuelles cles legacy et le cookie
 * cross-domain `clenzy_session`. Le cookie HttpOnly `clenzy_auth` est
 * invalide cote serveur via AuthSessionController#logout.
 */
export function clearTokens() {
  cleanupLegacyTokens()
  clearSessionCookie()
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


