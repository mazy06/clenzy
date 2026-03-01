import {
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  differenceInCalendarDays,
  isToday,
  isWeekend,
  isSameMonth,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ZoomLevel } from '../types';
import { ZOOM_CONFIGS } from '../constants';

export { addDays, subDays, isToday, isWeekend, isSameMonth, parseISO };

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

export function formatDayNumber(date: Date): string {
  return format(date, 'd');
}

export function formatDayShort(date: Date): string {
  return format(date, 'EEE', { locale: fr });
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: fr });
}

export function formatMonthShort(date: Date): string {
  return format(date, 'MMM', { locale: fr });
}

export function daysBetween(d1: Date, d2: Date): number {
  return differenceInCalendarDays(d2, d1);
}

/**
 * Compute the date range to display based on zoom level and current date.
 */
export function computeDateRange(currentDate: Date, zoom: ZoomLevel): { start: Date; end: Date } {
  const config = ZOOM_CONFIGS[zoom];
  const halfDays = Math.floor(config.visibleDays / 2);

  switch (zoom) {
    case 'day':
      return {
        start: subDays(currentDate, 2),
        end: addDays(currentDate, config.visibleDays - 3),
      };
    case 'week':
      return {
        start: startOfWeek(currentDate, { locale: fr }),
        end: addDays(startOfWeek(currentDate, { locale: fr }), config.visibleDays - 1),
      };
    case 'month': {
      const monthStart = startOfMonth(currentDate);
      return {
        start: monthStart,
        end: endOfMonth(currentDate),
      };
    }
    default:
      return {
        start: subDays(currentDate, halfDays),
        end: addDays(currentDate, halfDays),
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
