import {
  addDays,
  subDays,
  startOfWeek,
  eachDayOfInterval,
  format,
  differenceInCalendarDays,
  isToday,
  parseISO,
} from 'date-fns';
import type { ZoomLevel } from '../types';
import { ZOOM_CONFIGS } from '../constants';
import {
  endOfDisplayMonth,
  startOfDisplayMonth,
  weekStartsOnForLanguage,
} from '../../../utils/localeDate';

export { addDays, subDays, isToday, parseISO };

// `isWeekend` de date-fns n'est PAS reexporte ici : il ne connait que le
// week-end samedi-dimanche, quand l'arabe chome vendredi et samedi. La grille
// passe par `useDateFormat().isWeekend`, qui suit la langue active.

export function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function toDate(dateStr: string): Date {
  return parseISO(dateStr);
}

export function generateDays(start: Date, end: Date): Date[] {
  if (start > end) return [];
  return eachDayOfInterval({ start, end });
}

/**
 * Les libelles de dates (quantieme, jour, mois, date complete) ne vivent plus
 * ici : ils dependent de la LANGUE et, en arabe, du calendrier hegirien. Les
 * composants les prennent via `useDateFormat()` (`hooks/useDateFormat`), qui
 * les rebrasse au changement de langue — une grille memoisee resterait sinon
 * en francais.
 */

export function daysBetween(d1: Date, d2: Date): number {
  return differenceInCalendarDays(d2, d1);
}

/**
 * Fenêtre de dates affichée pour un niveau de zoom et une date courante.
 *
 * <p>Les deux bornes dépendent de la LANGUE. Le début de semaine d'abord —
 * lundi en français, dimanche en anglais comme en arabe. Le mois ensuite : en
 * arabe, « le mois » est un mois <b>hégirien</b>, qui commence et finit au
 * milieu d'un mois grégorien et compte 29 ou 30 jours. Découper la grille sur
 * des bornes grégoriennes tout en libellant l'en-tête en hégirien afficherait
 * un « mois » à cheval sur deux.</p>
 */
export function computeDateRange(
  currentDate: Date,
  zoom: ZoomLevel,
  lng?: string | null,
): { start: Date; end: Date } {
  const config = ZOOM_CONFIGS[zoom];

  switch (zoom) {
    // Semaine (7 j) et quinzaine (14 j) : calées sur le début de semaine.
    case 'week':
    case 'fortnight': {
      // Le premier jour de semaine vient de la POLITIQUE produit, pas des
      // options de la locale : `enUS` ouvrirait sa semaine le dimanche (cf.
      // weekStartsOnForLanguage).
      const start = startOfWeek(currentDate, { weekStartsOn: weekStartsOnForLanguage(lng) });
      return {
        start,
        end: addDays(start, config.visibleDays - 1),
      };
    }
    // Mois : mois calendaire complet, dans le calendrier affiché.
    case 'month':
      return {
        start: startOfDisplayMonth(currentDate, lng),
        end: endOfDisplayMonth(currentDate, lng),
      };
  }
}

/**
 * Compute extended date range for data fetching (adds buffer days).
 */
export function computeFetchRange(start: Date, end: Date, bufferDays = 7): { from: string; to: string } {
  return {
    from: toDateStr(subDays(start, bufferDays)),
    to: toDateStr(addDays(end, bufferDays)),
  };
}

/**
 * Add days to an ISO date string, return new ISO date string.
 */
export function addDaysToStr(dateStr: string, days: number): string {
  return toDateStr(addDays(parseISO(dateStr), days));
}

/**
 * Pixel offset within a day cell for a time string (HH:mm).
 */
export function getHourOffsetPx(timeStr: string | undefined, dayWidth: number): number {
  if (!timeStr || dayWidth <= 40) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  const fraction = (h + m / 60) / 24;
  return fraction * dayWidth;
}

// ─── Infinite scroll helpers ────────────────────────────────────────────────

/**
 * Compute a large buffer range centered on anchorDate.
 * Buffer extends visibleDays * multiplier on each side.
 */
export function computeBufferRange(
  anchorDate: Date,
  zoom: ZoomLevel,
  multiplier = 3,
): { start: Date; end: Date } {
  const config = ZOOM_CONFIGS[zoom];
  const bufferDays = config.visibleDays * multiplier;
  return {
    start: subDays(anchorDate, bufferDays),
    end: addDays(anchorDate, bufferDays),
  };
}

/**
 * Fixed epoch for chunk alignment (Jan 1 2020).
 */
const CHUNK_EPOCH = new Date(2020, 0, 1);

/**
 * Get all data-fetch chunks (aligned to fixed 30-day boundaries)
 * that overlap with the given date range.
 */
export function getOverlappingChunks(
  start: Date,
  end: Date,
  chunkSize = 30,
): Array<{ from: string; to: string }> {
  const startDaysSinceEpoch = differenceInCalendarDays(start, CHUNK_EPOCH);
  const endDaysSinceEpoch = differenceInCalendarDays(end, CHUNK_EPOCH);

  const firstChunkIndex = Math.floor(startDaysSinceEpoch / chunkSize);
  const lastChunkIndex = Math.floor(endDaysSinceEpoch / chunkSize);

  const chunks: Array<{ from: string; to: string }> = [];
  for (let i = firstChunkIndex; i <= lastChunkIndex; i++) {
    const chunkStart = addDays(CHUNK_EPOCH, i * chunkSize);
    const chunkEnd = addDays(chunkStart, chunkSize - 1);
    chunks.push({
      from: toDateStr(chunkStart),
      to: toDateStr(chunkEnd),
    });
  }
  return chunks;
}
