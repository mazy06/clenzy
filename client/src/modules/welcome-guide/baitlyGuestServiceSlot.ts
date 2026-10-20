import type { Lang } from './WelcomeBookView';

/** Le backend fournit une heure locale du logement, sans offset. Ne pas la convertir dans le fuseau du navigateur. */
export function guestServiceSlot(start: string | null, durationHours: number | null, lang: Lang) {
  const match = start?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const from = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (from.getUTCFullYear() !== year || from.getUTCMonth() !== month - 1 || from.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  const locale = { fr: 'fr-FR', en: 'en-GB', ar: 'ar' }[lang];
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const duration = durationHours != null && Number.isFinite(durationHours) && durationHours > 0 ? durationHours : null;
  const to = duration == null ? null : new Date(from.getTime() + duration * 3_600_000);
  const crossesDay = to != null && date.format(from) !== date.format(to);
  return {
    date: date.format(from),
    time: time.format(from),
    end: to ? `${crossesDay ? `${date.format(to)} · ` : ''}${time.format(to)}` : null,
    duration: duration == null ? null : new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'short', maximumFractionDigits: 2 }).format(duration),
  };
}
