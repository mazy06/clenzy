/** Choices offered by the quote request form instead of typed dates, times and minute counts. */
export const REQUEST_TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
export const REQUEST_DURATIONS = [30, 60, 90, 120, 180, 240, 480];

export function civilDateKey(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
}

/** The next `count` calendar days, starting today, in the device's local calendar. */
export function upcomingDays(now: Date, count = 14) {
  return Array.from({ length: count }, (_, offset) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    return { key: civilDateKey(day), offset, date: day };
  });
}

/** "1 h 30" rather than "90 min": durations are read, not computed. */
export function durationLabel(minutes: number, units: { hour: string; minute: string; day: string }) {
  if (minutes >= 480) return units.day;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} ${units.minute}`;
  return rest ? `${hours} ${units.hour} ${String(rest).padStart(2, '0')}` : `${hours} ${units.hour}`;
}
