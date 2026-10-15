import { AuthRequest, CodeChallengeMethod, ResponseType, exchangeCodeAsync, fetchDiscoveryAsync } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { KEYCLOAK_CONFIG } from '@/config/api';

/** Direct native PKCE: the app owns and consumes state, Baitly is not the OAuth callback server. */
export async function baitlyOAuth() {
  const discovery = await fetchDiscoveryAsync(KEYCLOAK_CONFIG.issuer);
  const state = Crypto.randomUUID();
  const started = Date.now();
  const request = new AuthRequest({ clientId: KEYCLOAK_CONFIG.clientId,
    redirectUri: KEYCLOAK_CONFIG.redirectUrl, scopes: [...KEYCLOAK_CONFIG.scopes],
    responseType: ResponseType.Code, usePKCE: true, codeChallengeMethod: CodeChallengeMethod.S256,
    state, extraParams: { prompt: 'login' } });
  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success' || result.params.state !== state || !result.params.code
      || !request.codeVerifier || Date.now() - started > 600_000) throw new Error('oauthRejected');
  // This request is local to one invocation; a callback cannot be reused after completion.
  const tokens = await exchangeCodeAsync({ clientId: KEYCLOAK_CONFIG.clientId,
    redirectUri: KEYCLOAK_CONFIG.redirectUrl, code: result.params.code,
    extraParams: { code_verifier: request.codeVerifier } }, discovery);
  if (!tokens.accessToken || !tokens.refreshToken) throw new Error('oauthRejected');
  return tokens;
}
