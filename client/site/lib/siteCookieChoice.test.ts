import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../src/services/storageService';
import { cookieChoiceExpiry, hasSitePurposeConsent, parseSiteCookieChoice, readSiteCookieChoice, saveSiteCookieChoice } from './siteCookieChoice';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-08T10:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('browser cookie choices', () => {
  it.each(['accepted', 'refused'] as const)('keeps %s for exactly six months without a tracking identifier', (decision) => {
    const { choice, persisted } = saveSiteCookieChoice(decision);
    expect(persisted).toBe(true);
    expect(readSiteCookieChoice()).toEqual(choice);
    expect(choice.expiresAt).toBe(Date.parse('2027-04-08T10:00:00Z'));
    expect(choice.purposes).toEqual([]);
    expect(Object.keys(choice).sort()).toEqual(['chosenAt', 'decision', 'expiresAt', 'purposes', 'version']);
    vi.setSystemTime(choice.expiresAt);
    expect(readSiteCookieChoice()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.SITE_COOKIE_CHOICE)).toBeNull();
  });
  it('clamps month-end dates and never renews on read', () => {
    expect(cookieChoiceExpiry(Date.parse('2026-08-31T10:00:00Z'))).toBe(Date.parse('2027-02-28T10:00:00Z'));
    const { choice } = saveSiteCookieChoice('accepted');
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(readSiteCookieChoice()?.expiresAt).toBe(choice.expiresAt);
  });
  it('requires a fresh choice after a notice change and rejects forged or malformed records', () => {
    const { choice } = saveSiteCookieChoice('accepted');
    for (const invalid of [null, '{}', 'not json', JSON.stringify({ ...choice, version: 'old' }),
      JSON.stringify({ ...choice, purposes: ['future-advertising'] }),
      JSON.stringify({ ...choice, chosenAt: Date.now() + 1 }),
      JSON.stringify({ ...choice, expiresAt: choice.expiresAt + 1 }),
      JSON.stringify({ ...choice, decision: 'scrolled' })]) {
      expect(parseSiteCookieChoice(invalid)).toBeNull();
    }
  });
  it('does not authorise undisclosed trackers before or after acceptance', () => {
    expect(hasSitePurposeConsent('analytics')).toBe(false);
    saveSiteCookieChoice('accepted');
    expect(hasSitePurposeConsent('analytics')).toBe(false);
    expect(hasSitePurposeConsent('advertising')).toBe(false);
  });
  it('allows refusal after acceptance without touching an authentication cookie', () => {
    document.cookie = 'clenzy_session=authenticated; path=/';
    saveSiteCookieChoice('accepted');
    saveSiteCookieChoice('refused');
    expect(readSiteCookieChoice()?.decision).toBe('refused');
    expect(document.cookie).toContain('clenzy_session=authenticated');
    document.cookie = 'clenzy_session=; max-age=0; path=/';
  });
  it('reports unavailable storage instead of claiming persistence', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    const result = saveSiteCookieChoice('refused');
    expect(result.persisted).toBe(false);
    expect(result.choice.decision).toBe('refused');
    expect(readSiteCookieChoice()).toBeNull();
  });
});
