import { getItem, setItem, removeItem, STORAGE_KEYS } from '../../src/services/storageService';

// Changing purposes/providers requires a new notice and a fresh choice. An acceptance
// of today's empty optional catalogue must NEVER authorise a future tracker.
export const SITE_COOKIE_NOTICE_VERSION = '2026-10-08.1';
export const SITE_OPTIONAL_PURPOSES: readonly string[] = Object.freeze([]);
export type SiteCookieDecision = 'accepted' | 'refused';
export interface SiteCookieChoice {
  version: string;
  decision: SiteCookieDecision;
  purposes: string[];
  chosenAt: number;
  expiresAt: number;
}

export function cookieChoiceExpiry(chosenAt: number): number {
  const date = new Date(chosenAt);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

export function parseSiteCookieChoice(raw: string | null, now = Date.now()): SiteCookieChoice | null {
  if (!raw) return null;
  try {
    const choice = JSON.parse(raw) as SiteCookieChoice;
    if (!choice || choice.version !== SITE_COOKIE_NOTICE_VERSION
      || !['accepted', 'refused'].includes(choice.decision)
      || !Number.isFinite(choice.chosenAt) || choice.chosenAt > now || choice.chosenAt < 0
      || choice.expiresAt !== cookieChoiceExpiry(choice.chosenAt) || choice.expiresAt <= now
      || !Array.isArray(choice.purposes)
      || choice.purposes.some((purpose) => !SITE_OPTIONAL_PURPOSES.includes(purpose))
      || (choice.decision === 'refused' && choice.purposes.length > 0)) return null;
    return choice;
  } catch {
    return null;
  }
}

export function readSiteCookieChoice() {
  const raw = getItem(STORAGE_KEYS.SITE_COOKIE_CHOICE);
  const choice = parseSiteCookieChoice(raw);
  if (raw && !choice) removeItem(STORAGE_KEYS.SITE_COOKIE_CHOICE);
  return choice;
}

export function saveSiteCookieChoice(decision: SiteCookieDecision) {
  const chosenAt = Date.now();
  const choice: SiteCookieChoice = {
    version: SITE_COOKIE_NOTICE_VERSION,
    decision,
    purposes: decision === 'accepted' ? [...SITE_OPTIONAL_PURPOSES] : [],
    chosenAt,
    expiresAt: cookieChoiceExpiry(chosenAt),
  };
  const serialized = JSON.stringify(choice);
  setItem(STORAGE_KEYS.SITE_COOKIE_CHOICE, serialized);
  return { choice, persisted: getItem(STORAGE_KEYS.SITE_COOKIE_CHOICE) === serialized };
}

/** Fail closed, including when a purpose is introduced after an earlier acceptance. */
export function hasSitePurposeConsent(purpose: string, choice = readSiteCookieChoice()): boolean {
  const valid = parseSiteCookieChoice(JSON.stringify(choice));
  return Boolean(valid?.decision === 'accepted'
    && SITE_OPTIONAL_PURPOSES.includes(purpose) && valid.purposes.includes(purpose));
}
