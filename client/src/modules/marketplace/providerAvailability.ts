import type { ProviderAvailabilityDto } from '../../services/api/marketplaceProvidersApi';
import { DAY_NAMES } from './providerPresentation';

/**
 * Condense une semaine de créneaux en phrases lisibles.
 *
 * <p>La fiche affichait la même information trois fois : le sous-titre listait
 * « Lun, Mar, Mer, Jeu, Ven, Sam », la bande répétait les sept initiales, puis
 * une liste donnait six fois « 09:00 – 17:00 ». Trois lectures pour un seul
 * fait : « du lundi au samedi, 9 h – 17 h ».</p>
 *
 * <p>Les jours CONSÉCUTIFS partageant les mêmes horaires sont fusionnés en
 * plage. Une semaine régulière tient alors sur une ligne, et une semaine
 * irrégulière garde le détail qu'elle mérite.</p>
 */
export interface WeekSpan {
  /** « Du lundi au samedi », « Lundi et mardi », « Dimanche ». */
  days: string;
  /** « 09:00 – 17:00 », ou plusieurs plages séparées par un point médian. */
  hours: string;
}

/** Jours ISO effectivement déclarés, pour la bande d'initiales. */
export function declaredDays(slots: ProviderAvailabilityDto[]): Set<number> {
  return new Set(slots.map((slot) => slot.dayOfWeek));
}

export function summariseWeek(slots: ProviderAvailabilityDto[], locale = 'fr'): WeekSpan[] {
  if (slots.length === 0) return [];

  // Signature horaire de chaque jour : c'est elle qui décide de la fusion.
  const byDay = new Map<number, string>();
  for (let day = 1; day <= 7; day += 1) {
    const ranges = slots
      .filter((slot) => slot.dayOfWeek === day)
      .map((slot) => `${slot.startTime.slice(0, 5)} – ${slot.endTime.slice(0, 5)}`)
      .sort();
    if (ranges.length > 0) byDay.set(day, ranges.join(' · '));
  }

  const spans: WeekSpan[] = [];
  let runStart: number | null = null;
  let runHours = '';

  const flush = (runEnd: number) => {
    if (runStart === null) return;
    spans.push({ days: formatDayRun(runStart, runEnd, locale), hours: runHours });
    runStart = null;
  };

  for (let day = 1; day <= 7; day += 1) {
    const hours = byDay.get(day);
    if (hours === undefined) {
      flush(day - 1);
      continue;
    }
    if (runStart === null) {
      runStart = day;
      runHours = hours;
    } else if (hours !== runHours) {
      flush(day - 1);
      runStart = day;
      runHours = hours;
    }
  }
  flush(7);

  return spans;
}

/** « Lundi » · « Lundi et mardi » · « Du lundi au samedi ». */
function formatDayRun(start: number, end: number, locale: string): string {
  if (!locale.startsWith('fr')) {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
    const first = formatter.format(new Date(Date.UTC(2024, 0, start)));
    const last = formatter.format(new Date(Date.UTC(2024, 0, end)));
    if (start === end) return first;
    return `${first} ${locale.startsWith('ar') ? 'إلى' : 'to'} ${last}`;
  }
  const first = DAY_NAMES[start - 1];
  const last = DAY_NAMES[end - 1];
  if (start === end) return first;
  // Deux jours accolés se disent, trois et plus se bornent : « lundi et mardi »
  // se lit mieux que « du lundi au mardi ».
  if (end - start === 1) return `${first} et ${last.toLowerCase()}`;
  return `Du ${first.toLowerCase()} au ${last.toLowerCase()}`;
}
