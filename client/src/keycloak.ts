import Keycloak, { KeycloakTokenParsed } from 'keycloak-js'
import { KEYCLOAK_CONFIG } from './config/api'
import { setItem, removeItem, getItem, getAccessToken as storageGetAccessToken, STORAGE_KEYS } from './services/storageService'

// Singleton Keycloak instance for the whole app
const keycloak = new Keycloak({
  url: KEYCLOAK_CONFIG.URL,
  realm: KEYCLOAK_CONFIG.REALM,
  clientId: KEYCLOAK_CONFIG.CLIENT_ID,
})

// Configuration Keycloak
keycloak.init({
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: false,
  enableLogging: true,
  pkceMethod: 'S256'
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

export function saveTokens(accessToken: string, refreshToken?: string) {
  setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
  if (refreshToken) setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
}

export function clearTokens() {
  removeItem(STORAGE_KEYS.ACCESS_TOKEN)
  removeItem(STORAGE_KEYS.REFRESH_TOKEN)
}

export function bootstrapFromStorage() {
  const access = getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''
  const refresh = getItem(STORAGE_KEYS.REFRESH_TOKEN) || ''
  if (!access) {
    ;keycloak.authenticated = false
    return
  }
  ;keycloak.token = access
  ;keycloak.refreshToken = refresh
  ;keycloak.authenticated = true
  const parsed = decodeJwt(access)
  const parsedR = decodeJwt(refresh)
  ;keycloak.tokenParsed = parsed
  ;keycloak.refreshTokenParsed = parsedR
  if (parsed?.iat) {
    const now = Math.floor(Date.now() / 1000)
    ;keycloak.timeSkew = now - parsed.iat
  }
}

export function getAccessToken(): string | null {
  return keycloak.token || storageGetAccessToken()
}

export function getParsedAccessToken(): KeycloakTokenParsed | undefined {
  const token = getAccessToken() || undefined
  return decodeJwt(token)
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}

export default keycloak


