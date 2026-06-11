import { describe, it, expect, beforeEach } from 'vitest';
import { setSessionCookie, getSessionCookie, clearSessionCookie } from '../storageService';

/**
 * Tests de securite du cookie cross-domain `clenzy_session`
 * (Z1-SEC-FRONTAUX-01).
 *
 * <p>Le cookie est partage avec la landing (clenzy.fr) pour la simple
 * detection de presence de session. Il ne doit JAMAIS contenir le JWT
 * d'acces : une XSS sur n'importe quel sous-domaine pourrait le lire.</p>
 */

/** Construit un JWT factice (non signe) avec le payload donne. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.signature`;
}

describe('storageService — clenzy_session cookie (Z1-SEC-FRONTAUX-01)', () => {
  beforeEach(() => {
    clearSessionCookie();
  });

  it('whenSettingSessionCookieWithValidToken_thenJwtIsNeverStoredInCookie', () => {
    // Arrange
    const token = fakeJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 1800 });

    // Act
    setSessionCookie(token);

    // Assert
    expect(document.cookie).not.toContain(token);
    expect(document.cookie).not.toContain(encodeURIComponent(token));
    expect(getSessionCookie()).toBe('authenticated');
  });

  it('whenTokenIsExpired_thenSessionCookieIsCleared', () => {
    // Arrange — pose d'abord un marqueur valide
    setSessionCookie(fakeJwt({ exp: Math.floor(Date.now() / 1000) + 1800 }));
    const expiredToken = fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });

    // Act
    setSessionCookie(expiredToken);

    // Assert — un token expire ne doit pas signaler une session active
    expect(getSessionCookie()).toBeNull();
  });

  it('whenTokenIsMalformed_thenOpaqueMarkerIsStillSetWithoutLeakingValue', () => {
    // Arrange
    const malformed = 'not-a-jwt';

    // Act
    setSessionCookie(malformed);

    // Assert — repli TTL 1h : le marqueur est pose, jamais la valeur brute
    expect(getSessionCookie()).toBe('authenticated');
    expect(document.cookie).not.toContain(malformed);
  });

  it('whenClearingSessionCookie_thenMarkerIsRemoved', () => {
    // Arrange
    setSessionCookie(fakeJwt({ exp: Math.floor(Date.now() / 1000) + 1800 }));

    // Act
    clearSessionCookie();

    // Assert
    expect(getSessionCookie()).toBeNull();
  });
});
