/**
 * Formatage de dates lie a la langue ACTIVE.
 *
 * <p>Les fonctions de `utils/localeDate` sont pures : elles recoivent la langue
 * en parametre. Ce hook les lie a la langue courante et, surtout, <b>abonne le
 * composant au changement de langue</b> — sans quoi une grille memoisee
 * (`React.memo`) garderait ses libelles francais apres un passage en arabe,
 * ses props n'ayant pas bouge.</p>
 *
 * <pre>
 *   const { formatMonthYear, isHijri } = useDateFormat();
 *   <h2>{formatMonthYear(currentDate)}</h2>
 * </pre>
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDisplayMonths,
  calendarForLanguage,
  endOfDisplayMonth,
  formatDayMonth,
  formatDayMonthShort,
  formatDayMonthYearShort,
  formatDayNumber,
  formatFullDate,
  formatMonthYear,
  formatMonthYearShort,
  formatPattern,
  formatShortDate,
  formatWeekdayShort,
  intlLocale,
  isDisplayWeekend,
  isRtlLanguage,
  normalizeLanguage,
  startOfDisplayMonth,
  toDisplayParts,
  weekStartsOnForLanguage,
  type AppLanguage,
  type CalendarParts,
  type CalendarSystem,
} from '../utils/localeDate';

export interface DateFormatApi {
  /** Langue active, normalisee (`fr` | `en` | `ar`). */
  language: AppLanguage;
  /** Calendrier d'affichage de cette langue. */
  calendar: CalendarSystem;
  /** Raccourci : le calendrier affiche est-il l'hegirien ? */
  isHijri: boolean;
  /** La langue active s'ecrit-elle de droite a gauche ? */
  isRtl: boolean;
  /**
   * Etiquette `Intl` de la langue (calendrier hegirien compris en arabe), a
   * passer telle quelle a `toLocaleDateString` & consorts quand le jeu
   * d'options est propre au site d'appel.
   */
  localeTag: string;

  formatDayNumber: (date: Date) => string;
  formatWeekdayShort: (date: Date) => string;
  formatMonthYear: (date: Date) => string;
  formatMonthYearShort: (date: Date) => string;
  formatFullDate: (date: Date) => string;
  formatShortDate: (date: Date) => string;
  formatDayMonth: (date: Date) => string;
  formatDayMonthShort: (date: Date) => string;
  formatDayMonthYearShort: (date: Date) => string;
  /** Motif date-fns libre — reserve aux motifs d'HEURE (cf. localeDate). */
  formatPattern: (date: Date, pattern: string) => string;

  /**
   * Le jour tombe-t-il sur le week-end de la langue active ? Vendredi-samedi
   * en arabe, samedi-dimanche ailleurs (cf. `isDisplayWeekend`).
   */
  isWeekend: (date: Date) => boolean;

  /**
   * Premier jour de la semaine de la langue — 0 = dimanche, 1 = lundi. Pour
   * les grilles mensuelles, qui posent leurs sept colonnes a la main.
   */
  weekStartsOn: 0 | 1;

  startOfDisplayMonth: (date: Date) => Date;
  endOfDisplayMonth: (date: Date) => Date;
  addDisplayMonths: (date: Date, amount: number) => Date;
  toDisplayParts: (date: Date) => CalendarParts;
}

export function useDateFormat(): DateFormatApi {
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.language);

  return useMemo<DateFormatApi>(
    () => ({
      language,
      calendar: calendarForLanguage(language),
      isHijri: calendarForLanguage(language) === 'islamic-umalqura',
      isRtl: isRtlLanguage(language),
      localeTag: intlLocale(language),

      formatDayNumber: (date) => formatDayNumber(date, language),
      formatWeekdayShort: (date) => formatWeekdayShort(date, language),
      formatMonthYear: (date) => formatMonthYear(date, language),
      formatMonthYearShort: (date) => formatMonthYearShort(date, language),
      formatFullDate: (date) => formatFullDate(date, language),
      formatShortDate: (date) => formatShortDate(date, language),
      formatDayMonth: (date) => formatDayMonth(date, language),
      formatDayMonthShort: (date) => formatDayMonthShort(date, language),
      formatDayMonthYearShort: (date) => formatDayMonthYearShort(date, language),
      formatPattern: (date, pattern) => formatPattern(date, pattern, language),

      isWeekend: (date) => isDisplayWeekend(date, language),
      weekStartsOn: weekStartsOnForLanguage(language),

      startOfDisplayMonth: (date) => startOfDisplayMonth(date, language),
      endOfDisplayMonth: (date) => endOfDisplayMonth(date, language),
      addDisplayMonths: (date, amount) => addDisplayMonths(date, amount, language),
      toDisplayParts: (date) => toDisplayParts(date, language),
    }),
    [language],
  );
}
