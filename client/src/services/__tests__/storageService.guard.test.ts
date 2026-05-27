import { describe, it, expect } from 'vitest';
import { STORAGE_KEYS } from '../storageService';

/**
 * Tests architecturaux du module storageService.
 *
 * <p>Le but de ces tests est de **prevenir les regressions futures** sur les
 * decisions d'architecture liees au stockage cote client :</p>
 *
 * <ul>
 *   <li><b>Pas de tokens auth en localStorage</b> (CLAUDE.md regle securite #7).
 *       Tout caller qui essaierait d'ajouter un {@code kc_*_token} ou
 *       equivalent dans {@link STORAGE_KEYS} echouera ici → forcera une
 *       discussion d'architecture (cookie HttpOnly via backend, in-memory).</li>
 *   <li><b>Format des cles centralise</b>. Toute cle de prod doit etre
 *       prefixee {@code clenzy_*} (sauf {@code i18nextLng} qui est standard
 *       i18next library).</li>
 *   <li><b>Pas de duplication.</b> Chaque cle doit etre unique.</li>
 * </ul>
 *
 * <p>Si l'un de ces tests echoue, NE PAS le contourner — il signale une
 * derive architecturale. Cf. CLAUDE.md "Frontend Storage — decision tree".</p>
 */

describe('storageService — architectural guards', () => {
  const allKeys = Object.values(STORAGE_KEYS);

  describe('no auth tokens in localStorage (CLAUDE.md security #7)', () => {
    const FORBIDDEN_PATTERNS = [
      /access[_-]?token/i,
      /refresh[_-]?token/i,
      /id[_-]?token/i,
      /jwt/i,
      /^kc_/i,                  // Keycloak naming
      /bearer/i,
      /session[_-]?token/i,
      /auth[_-]?token/i,
    ];

    it.each(FORBIDDEN_PATTERNS)(
      'rejects keys matching forbidden pattern: %s',
      (pattern) => {
        const offenders = allKeys.filter((k) => pattern.test(k));
        expect(offenders).toEqual([]);
      }
    );

    it('explicitly does not contain known legacy token key names', () => {
      const knownBadKeys = [
        'kc_access_token',
        'kc_refresh_token',
        'kc_id_token',
        'kc_expires_in',
        'jwt_token',
        'auth_token',
        'bearer_token',
      ];
      const present = knownBadKeys.filter((k) => allKeys.includes(k as never));
      expect(present).toEqual([]);
    });
  });

  describe('key format', () => {
    it('all keys are non-empty strings', () => {
      for (const k of allKeys) {
        expect(typeof k).toBe('string');
        expect(k.length).toBeGreaterThan(0);
      }
    });

    it('all keys are unique (no accidental duplicate)', () => {
      const set = new Set(allKeys);
      expect(set.size).toBe(allKeys.length);
    });

    it('all keys use clenzy_ prefix or are well-known third-party names', () => {
      // Exceptions documentees : libs externes qui gerent leur propre cle.
      const ALLOWED_NON_PREFIXED = new Set<string>([
        'i18nextLng', // i18next-browser-languagedetector standard
      ]);
      const offenders = allKeys.filter(
        (k) => !k.startsWith('clenzy_') && !ALLOWED_NON_PREFIXED.has(k as string),
      );
      expect(offenders).toEqual([]);
    });
  });
});
