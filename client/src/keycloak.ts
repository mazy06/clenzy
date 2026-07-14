import Keycloak, { KeycloakTokenParsed } from 'keycloak-js'
import { KEYCLOAK_CONFIG } from './config/api'
import {
  setSessionCookie,
  setSessionCookieUntil,
  clearSessionCookie,
  cleanupLegacyTokens,
} from './services/storageService'

/**
 * Shape de la reponse GET /api/auth/session (AuthSessionController.SessionInfoDto).
 * SECURITE (Z1-SEC-FRONTAUX-02) : ne contient QUE des claims non sensibles —
 * le backend ne renvoie JAMAIS le token brut.
 */
interface SessionInfo {
  authenticated?: boolean
  expiresAt?: number
  subject?: string
  preferredUsername?: string
  email?: string
  givenName?: string
  familyName?: string
  roles?: string[]
}

// Singleton Keycloak instance for the whole app
const keycloak = new Keycloak({
  url: KEYCLOAK_CONFIG.URL,
  realm: KEYCLOAK_CONFIG.REALM,
  clientId: KEYCLOAK_CONFIG.CLIENT_ID,
})

// Re-aligner le marqueur de session cross-domain `clenzy_session` quand
// Keycloak rafraichit le token en arriere-plan. Le cookie ne contient PAS
// le token (Z1-SEC-FRONTAUX-01) : setSessionCookie n'utilise le token que
// pour caler le max-age du cookie sur l'expiration reelle de la session.
// useAuth.ts pose son propre onAuthSuccess pour la logique utilisateur,
// donc on n'utilise pas onAuthSuccess ici pour eviter le conflit.
keycloak.onAuthRefreshSuccess = () => {
  if (keycloak.token) {
    setSessionCookie(keycloak.token)
    // Re-pousse le couple access+refresh vers les cookies HttpOnly backend
    // (clenzy_auth + clenzy_refresh) et re-arme le refresh proactif sur la
    // nouvelle expiration.
    void pushSessionToBackend()
    scheduleProactiveRefresh()
  }
}

// Keycloak declenche onTokenExpired quand l'access token en memoire expire.
// On tente un renouvellement immediat (JS si refresh token dispo, sinon cookie
// serveur). Sans ce handler, keycloak-js ne rafraichit rien de lui-meme.
keycloak.onTokenExpired = () => {
  void triggerRefresh().then((ok) => {
    // Ne re-arme que sur succes : sinon (session non renouvelable) on laisse le
    // 401 de la prochaine requete API declencher le flow naturel, plutot que de
    // boucler toutes les 5 s sur un refresh voue a l'echec.
    if (ok) scheduleProactiveRefresh()
  })
}

keycloak.onAuthLogout = () => {
  clearSessionCookie()
}

// Cleanup one-shot des anciens tokens stockes en localStorage par les
// versions anterieures (avant la migration vers cookie HttpOnly). Idempotent.
cleanupLegacyTokens()

// Configuration Keycloak.
//
// IMPORTANT — restauration de la session depuis le cookie HttpOnly au boot :
// Le check-sso Keycloak (iframe silent) est fragile en localhost (ports
// differents = cross-site, cookies Keycloak SameSite=Lax pas envoyes) et
// en prod avec Safari ITP. Resultat : meme si l'user a un cookie HttpOnly
// `clenzy_auth` valide cote backend, keycloak.init() retourne `authenticated=false`
// → l'app deconnecte l'user au hard refresh.
//
// Fix : AVANT keycloak.init(), on appelle GET /api/auth/session avec le
// cookie HttpOnly. Si le backend confirme la session (Spring Security +
// TokenCookieFilter valident le cookie), il renvoie les METADONNEES de
// session (claims non sensibles, jamais le token brut — Z1-SEC-FRONTAUX-02).
// Si check-sso echoue ensuite, on restaure l'etat UI depuis ces metadonnees :
// les appels API portent le cookie HttpOnly automatiquement
// (credentials: 'include'), le JS n'a pas besoin du token.
//
// Ce qu'on appelle ici DOIT etre une fonction asynchrone — d'ou le wrap
// dans une IIFE async. La promise resultante est exportee pour que App.tsx
// puisse l'await avant toute decision auth (cf. useEffect d'init App).
// Step 1 : demander au backend si le cookie HttpOnly porte une session valide.
// La reponse ne contient que des claims non sensibles (cf. SessionInfo).
//
// PERF (audit navigation 2026-07) : ce fetch et keycloak.init() ci-dessous
// sont INDEPENDANTS (backend vs iframe Keycloak) — ils partent donc en
// PARALLELE. L'ancienne version awaitait la session avant de lancer init(),
// ajoutant un round-trip complet au chemin critique du boot. La decision
// (check-sso prioritaire, metadonnees en fallback) reste identique.
const bootstrapSessionPromise: Promise<SessionInfo | null> = (async () => {
  try {
    const { API_CONFIG } = await import('./config/api')
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/auth/session`, {
      method: 'GET',
      credentials: 'include', // Envoyer le cookie HttpOnly clenzy_auth
    })
    if (response.ok) {
      const data = await response.json() as SessionInfo
      const stillValid = typeof data.expiresAt === 'number' && data.expiresAt * 1000 > Date.now()
      if (data.authenticated && stillValid) {
        return data
      }
    }
  } catch {
    // Silent — backend pas joignable ou pas de cookie → on tombera sur check-sso
  }
  return null
})()

/**
 * /api/me ANTICIPÉ (perf boot) : part dès que le backend confirme la session,
 * en PARALLÈLE du check-sso Keycloak (l'étape la plus lente du boot). Le
 * cookie HttpOnly suffit : TokenCookieFilter injecte l'Authorization côté
 * serveur, pas besoin d'attendre le token Keycloak. AuthContext consomme ce
 * résultat en priorité (une seule fois) et refetch normalement s'il est null.
 * Résout en JSON (pas en Response) pour être consommable plusieurs fois
 * (StrictMode double-run) sans erreur « body already read ».
 */
export const eagerMePromise: Promise<Record<string, unknown> | null> =
  bootstrapSessionPromise.then(async (session) => {
    if (!session) return null
    try {
      const { API_CONFIG } = await import('./config/api')
      const response = await fetch(API_CONFIG.ENDPOINTS.ME, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!response.ok) return null
      return await response.json() as Record<string, unknown>
    } catch {
      return null
    }
  })

export const keycloakInitPromise: Promise<boolean> = (async () => {
  // Step 2 : init Keycloak avec check-sso classique (en parallèle du step 1).
  // Si Keycloak retourne authenticated=true (cookies Keycloak natifs OK) → fin.
  // Sinon mais le backend a confirme la session (bootstrapSession) → on
  // restaure l'etat UI depuis les metadonnees (mode degrade sans token JS).
  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      checkLoginIframe: false,
      enableLogging: true,
      pkceMethod: 'S256',
    })

    if (authenticated && keycloak.token) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[keycloak] check-sso reussi — session restauree via Keycloak natif')
      }
      setSessionCookie(keycloak.token)
      // Pousse access + refresh vers les cookies HttpOnly backend (login ou
      // check-sso reussi) et arme le refresh proactif.
      await pushSessionToBackend()
      scheduleProactiveRefresh()
      return true
    }

    // Fallback : check-sso a echoue (cookies Keycloak natifs absents ou
    // hostname mismatch), mais le backend a confirme la session via le
    // cookie HttpOnly clenzy_auth. On restaure l'etat UI depuis les
    // metadonnees de session (sans token cote JS).
    const bootstrapSession = await bootstrapSessionPromise
    if (bootstrapSession) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[keycloak] check-sso a echoue mais session confirmee par le cookie HttpOnly — restauration via metadonnees')
      }
      restoreSessionFromMetadata(bootstrapSession)
      return true
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[keycloak] aucune session restauree — ni check-sso, ni cookie HttpOnly')
    }
    return false
  } catch {
    // Silent — l'init peut echouer si Keycloak n'est pas joignable ;
    // l'app gere ce cas via les guards habituels.
    const bootstrapSession = await bootstrapSessionPromise
    if (bootstrapSession) {
      // Meme en cas d'erreur init, si le backend a confirme la session, on restaure
      restoreSessionFromMetadata(bootstrapSession)
      return true
    }
    return false
  }
})()

/**
 * Restaure l'etat "authentifie" de Keycloak a partir des metadonnees de
 * session renvoyees par GET /api/auth/session (cookie HttpOnly valide cote
 * backend).
 *
 * SECURITE (Z1-SEC-FRONTAUX-02) : le token brut ne quitte JAMAIS le cookie
 * HttpOnly — `keycloak.token` reste undefined dans ce mode. Tous les appels
 * API portent le cookie automatiquement (`credentials: 'include'` dans
 * apiClient et les fetch directs, header Authorization injecte cote serveur
 * par TokenCookieFilter).
 *
 * Limitations connues de ce mode degrade (comme avant : pas de refreshToken,
 * re-login a l'expiration ~1h) :
 *  - la connexion WebSocket STOMP (StompService) exige un Bearer dans la
 *    trame CONNECT et reste differee jusqu'au prochain login/check-sso
 *    reussi (suivi #156 : auth WS par cookie a la handshake).
 */
function restoreSessionFromMetadata(session: SessionInfo): void {
  keycloak.authenticated = true
  keycloak.tokenParsed = {
    exp: session.expiresAt,
    sub: session.subject,
    preferred_username: session.preferredUsername,
    email: session.email,
    given_name: session.givenName,
    family_name: session.familyName,
    realm_access: { roles: session.roles ?? [] },
  } as KeycloakTokenParsed
  if (session.expiresAt) {
    setSessionCookieUntil(session.expiresAt)
  }
  // Mode degrade : pas de refresh token JS, mais le cookie HttpOnly
  // clenzy_refresh (pose lors d'un login precedent) permet un renouvellement
  // cote serveur. On arme le refresh proactif qui empruntera ce chemin cookie.
  scheduleProactiveRefresh()
}

// ─── Refresh proactif de session ─────────────────────────────────────────────

/**
 * Pousse le couple access + refresh token vers les cookies HttpOnly backend
 * (clenzy_auth + clenzy_refresh). Best-effort : le refresh token n'est transmis
 * qu'ici, une seule fois, et n'est jamais persiste cote JS.
 */
async function pushSessionToBackend(): Promise<void> {
  if (!keycloak.token) return
  const { syncTokenCookie } = await import('./services/apiClient')
  await syncTokenCookie(keycloak.token, keycloak.refreshToken)
}

/**
 * Renouvelle la session via le mutex partage d'apiClient (chemin JS si refresh
 * token en memoire, sinon cookie serveur clenzy_refresh). Retourne true si OK.
 */
async function triggerRefresh(): Promise<boolean> {
  const { refreshSession } = await import('./services/apiClient')
  return refreshSession()
}

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Programme un renouvellement de session ~60 s AVANT l'expiration de l'access
 * token courant, puis se re-arme sur la nouvelle expiration. Fonctionne dans
 * les deux modes (token JS present ou mode degrade cookie-only), ce qui evite
 * de dependre uniquement d'un 401 pour renouveler la session (onglet idle,
 * WebSocket, etc.). Sans jeton exploitable, ne fait rien.
 */
function scheduleProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer)
    proactiveRefreshTimer = null
  }
  const exp = getParsedAccessToken()?.exp
  if (!exp) return
  // 60 s de marge avant expiration ; plancher a 5 s pour ne pas boucler serre.
  const delayMs = Math.max(exp * 1000 - Date.now() - 60_000, 5_000)
  proactiveRefreshTimer = setTimeout(() => {
    void triggerRefresh().then((ok) => {
      // Re-arme uniquement sur succes (cf. onTokenExpired) pour eviter toute
      // boucle serree quand la session n'est plus renouvelable.
      if (ok) scheduleProactiveRefresh()
    })
  }, delayMs)
}

/**
 * Decode le payload d'un JWT (claims) en gerant correctement le base64url
 * (`-`/`_` → `+`/`/`). `atob()` brut echoue sur ces caracteres : c'est pourquoi
 * tout decodage artisanal `JSON.parse(atob(token.split('.')[1]))` est interdit
 * (cf. F6-IDENTITY-01) — utiliser cette fonction partout (auto-login, etc.).
 * Retourne `undefined` si le token est absent ou malforme (jamais de throw).
 */
export function decodeJwt(token?: string): KeycloakTokenParsed | undefined {
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
 * Retourne le token Keycloak en memoire. Pour les requetes API, prefere
 * `credentials: 'include'` (cookie HttpOnly automatique via apiClient.ts)
 * plutot que d'injecter ce token manuellement dans un header Authorization.
 *
 * Peut etre null alors que la session est valide : apres un hard refresh
 * restaure via les metadonnees du cookie HttpOnly (Z1-SEC-FRONTAUX-02), le
 * token ne quitte pas le cookie. Toujours guarder (`token ? {...} : {}`) et
 * envoyer `credentials: 'include'` en repli.
 */
export function getAccessToken(): string | null {
  return keycloak.token || null
}

export function getParsedAccessToken(): KeycloakTokenParsed | undefined {
  // tokenParsed couvre aussi le mode "restaure via metadonnees" (pas de token JS)
  return keycloak.tokenParsed ?? decodeJwt(getAccessToken() || undefined)
}

export function isAuthenticated(): boolean {
  return Boolean(keycloak.authenticated)
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
  // Transmet aussi le refresh token (quand present) pour tenir a jour le cookie
  // HttpOnly clenzy_refresh utilise par le renouvellement cote serveur.
  await syncTokenCookie(token, keycloak.refreshToken)
}

export default keycloak


