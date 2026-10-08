import { activeIntlLocale } from '../../utils/activeLocale';

/** Jour calendaire LOCAL : `new Date('2026-07-01')` serait minuit UTC, la veille à l'ouest. */
function parseDay(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Nuits entre l'arrivée et le départ ; l'arrondi absorbe les jours de 23 h ou 25 h des changements d'heure. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const nights = Math.round((parseDay(checkOut).getTime() - parseDay(checkIn).getTime()) / 86_400_000);
  return Math.max(0, nights);
}

/** « 24 juin – 10 juil. », avec l'année seulement si le séjour sort de l'année en cours. */
export function formatStayRange(checkIn: string, checkOut: string, now: Date = new Date()): string {
  if (!checkIn || !checkOut) return '—';
  const start = parseDay(checkIn);
  const end = parseDay(checkOut);
  const currentYear = now.getFullYear();
  const withYear = start.getFullYear() !== currentYear || end.getFullYear() !== currentYear;
  // `formatRange` (ES2021) dit la plage dans l'ordre et la ponctuation de la
  // langue ; la cible ES2020 du projet ne le déclare pas.
  const format: Intl.DateTimeFormat & { formatRange?: (start: Date, end: Date) => string } =
    new Intl.DateTimeFormat(activeIntlLocale(), {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  return format.formatRange ? format.formatRange(start, end) : `${format.format(start)} – ${format.format(end)}`;
}

/** « mer. 24 juin 2026 » : la date d'arrivée ou de départ telle qu'on la dit au voyageur. */
export function formatStayDay(iso: string): string {
  if (!iso) return '—';
  return parseDay(iso).toLocaleDateString(activeIntlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Horodatage serveur (paiement, envoi de lien) en date et heure locales. */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(activeIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}
