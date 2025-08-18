import Keycloak from 'keycloak-js'

// Singleton Keycloak instance for the whole app
const keycloak = new Keycloak({
  url: 'http://localhost:8083',
  realm: 'clenzy',
  clientId: 'clenzy-web',
})

// Configuration Keycloak
keycloak.init({
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: false,
  enableLogging: true,
  pkceMethod: 'S256'
})

function decodeJwt(token?: string): any | undefined {
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
  localStorage.setItem('kc_access_token', accessToken)
  if (refreshToken) localStorage.setItem('kc_refresh_token', refreshToken)
}

export function clearTokens() {
  localStorage.removeItem('kc_access_token')
  localStorage.removeItem('kc_refresh_token')
}

export function bootstrapFromStorage() {
  const access = localStorage.getItem('kc_access_token') || ''
  const refresh = localStorage.getItem('kc_refresh_token') || ''
  if (!access) {
    ;(keycloak as any).authenticated = false
    return
  }
  ;(keycloak as any).token = access
  ;(keycloak as any).refreshToken = refresh
  ;(keycloak as any).authenticated = true
  const parsed = decodeJwt(access)
  const parsedR = decodeJwt(refresh)
  ;(keycloak as any).tokenParsed = parsed
  ;(keycloak as any).refreshTokenParsed = parsedR
  if (parsed?.iat) {
    const now = Math.floor(Date.now() / 1000)
    ;(keycloak as any).timeSkew = now - parsed.iat
  }
}

export function getAccessToken(): string | null {
  return (keycloak as any).token || localStorage.getItem('kc_access_token')
}

export function getParsedAccessToken(): any | undefined {
  const token = getAccessToken() || undefined
  return decodeJwt(token)
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}

export default keycloak


