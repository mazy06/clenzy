import type { SiteLanguage } from './siteLanguage';

const DAY_MS = 86_400_000;
export const DEMO_TODAY = '2026-09-26';
export const demoDate = (offset: number) =>
  new Date(Date.UTC(2026, 8, 23 + offset));
const dates = new Map<string, Intl.DateTimeFormat>();
const numbers = new Map<string, Intl.NumberFormat>();

/** Only localized presentation copy is transformed, never IDs, URLs or input. */
export function demoDigits(text: string, language: SiteLanguage): string {
  return language === 'ar'
    ? text.replace(/[0-9]/g, (n) => '٠١٢٣٤٥٦٧٨٩'[Number(n)])
    : text;
}

export function localizeDemoCopy<T>(copy: T): T {
  if (typeof copy === 'string') return demoDigits(copy, 'ar') as T;
  if (Array.isArray(copy)) return copy.map(localizeDemoCopy) as T;
  if (copy && typeof copy === 'object') {
    return Object.fromEntries(
      Object.entries(copy).map(([key, value]) => [
        key,
        localizeDemoCopy(value),
      ]),
    ) as T;
  }
  return copy;
}

export function demoNumber(
  value: number,
  language: SiteLanguage,
  options: Intl.NumberFormatOptions = {},
) {
  const key = `${language}:${JSON.stringify(options)}`;
  if (!numbers.has(key))
    numbers.set(
      key,
      new Intl.NumberFormat(language, {
        numberingSystem: language === 'ar' ? 'arab' : 'latn',
        useGrouping: false,
        ...options,
      }),
    );
  return numbers.get(key)!.format(value);
}

export function demoDateLabel(
  date: Date | string,
  language: SiteLanguage,
  options: Intl.DateTimeFormatOptions,
) {
  const key = `${language}:${JSON.stringify(options)}`;
  if (!dates.has(key))
    dates.set(
      key,
      new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : language, {
        ...options,
        calendar: language === 'ar' ? 'islamic-umalqura' : 'gregory',
        numberingSystem: language === 'ar' ? 'arab' : 'latn',
        timeZone: 'UTC',
      }),
    );
  return dates
    .get(key)!
    .format(typeof date === 'string' ? new Date(date) : date);
}

export function demoWeekend(date: Date, language: SiteLanguage) {
  const day = date.getUTCDay();
  return language === 'ar' ? day === 5 || day === 6 : day === 0 || day === 6;
}

/** Real month boundaries, including 29-day Hijri months; ISO dates drive actions. */
export function demoCalendarMonth(
  language: SiteLanguage,
  reference = DEMO_TODAY,
) {
  const anchor = new Date(reference);
  const parts = new Intl.DateTimeFormat('en', {
    calendar: language === 'ar' ? 'islamic-umalqura' : 'gregory',
    numberingSystem: 'latn',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const read = (date: Date, type: Intl.DateTimeFormatPartTypes) =>
    parts.formatToParts(date).find((p) => p.type === type)!.value;
  const first = new Date(
    anchor.getTime() - (Number(read(anchor, 'day')) - 1) * DAY_MS,
  );
  const firstMonth = read(first, 'month');
  const weekStart = language === 'ar' ? 0 : 1;
  const cells: (Date | null)[] = Array.from(
    { length: (first.getUTCDay() - weekStart + 7) % 7 },
    () => null,
  );
  for (let i = 0; i < 31; i++) {
    const date = new Date(first.getTime() + i * DAY_MS);
    if (read(date, 'month') !== firstMonth) break;
    cells.push(date);
  }
  return {
    title: demoDateLabel(anchor, language, { month: 'long', year: 'numeric' }),
    cells,
    weekdays: Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.UTC(2024, 0, 7 + weekStart + i));
      return {
        label: demoDateLabel(date, language, { weekday: 'narrow' }),
        title: demoDateLabel(date, language, { weekday: 'long' }),
      };
    }),
  };
}
