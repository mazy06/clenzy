import { describe, it, expect } from 'vitest';
import {
  addHijriMonths,
  calendarForLanguage,
  daysInHijriMonth,
  endOfHijriMonth,
  formatDayNumber,
  formatMonthYear,
  formatWeekdayShort,
  isDisplayWeekend,
  isRtlLanguage,
  normalizeLanguage,
  startOfHijriMonth,
  toHijri,
  weekdayHeaders,
  weekStartsOnForLanguage,
} from '../localeDate';

/** Midi local : evite qu'un fuseau negatif fasse basculer la date d'un jour. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe('normalizeLanguage', () => {
  it('ramene les variantes regionales a la langue de base', () => {
    expect(normalizeLanguage('ar-SA')).toBe('ar');
    expect(normalizeLanguage('en-GB')).toBe('en');
    expect(normalizeLanguage('fr-CA')).toBe('fr');
  });

  it('retombe sur le francais pour une langue inconnue ou absente', () => {
    expect(normalizeLanguage('de')).toBe('fr');
    expect(normalizeLanguage(undefined)).toBe('fr');
  });
});

describe('calendarForLanguage', () => {
  it('reserve le calendrier hegirien a l arabe', () => {
    expect(calendarForLanguage('ar')).toBe('islamic-umalqura');
    expect(calendarForLanguage('fr')).toBe('gregory');
    expect(calendarForLanguage('en')).toBe('gregory');
  });
});

describe('isRtlLanguage', () => {
  it('ne reconnait que l arabe', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('fr')).toBe(false);
  });
});

describe('toHijri', () => {
  // Reperes Umm al-Qura verifiables : le 1er Ramadan 1445 tombe le
  // 11 mars 2024, et le 1er Muharram 1446 le 7 juillet 2024.
  it('convertit une date gregorienne en date hegirienne', () => {
    expect(toHijri(at(2024, 3, 11))).toEqual({ year: 1445, month: 9, day: 1 });
    expect(toHijri(at(2024, 7, 7))).toEqual({ year: 1446, month: 1, day: 1 });
  });
});

describe('startOfHijriMonth / endOfHijriMonth', () => {
  it('borne le mois hegirien qui contient la date', () => {
    const middle = at(2024, 3, 20); // 10 Ramadan 1445
    expect(toHijri(startOfHijriMonth(middle))).toEqual({ year: 1445, month: 9, day: 1 });

    const end = endOfHijriMonth(middle);
    expect(toHijri(end).month).toBe(9);
    // Le lendemain bascule sur le mois suivant : la borne est bien la derniere.
    expect(toHijri(new Date(end.getTime() + 24 * 3600 * 1000)).month).toBe(10);
  });

  it('rend des mois de 29 ou 30 jours, jamais autre chose', () => {
    for (let i = 0; i < 24; i++) {
      const length = daysInHijriMonth(addHijriMonths(at(2024, 1, 15), i));
      expect([29, 30]).toContain(length);
    }
  });
});

describe('addHijriMonths', () => {
  it('avance d un mois hegirien, quantieme preserve', () => {
    const next = addHijriMonths(at(2024, 3, 20), 1); // 10 Ramadan 1445 → 10 Chawwal
    expect(toHijri(next)).toEqual({ year: 1445, month: 10, day: 10 });
  });

  it('recule d un mois hegirien', () => {
    const prev = addHijriMonths(at(2024, 3, 20), -1);
    expect(toHijri(prev)).toEqual({ year: 1445, month: 8, day: 10 });
  });

  it('franchit le passage d annee', () => {
    const crossed = addHijriMonths(at(2024, 7, 7), -1); // 1 Muharram 1446 → Dhou al-hijja 1445
    expect(toHijri(crossed).year).toBe(1445);
    expect(toHijri(crossed).month).toBe(12);
  });

  it('ramene un 30 au dernier jour d un mois de 29', () => {
    // On cherche un mois de 30 jours suivi d'un mois de 29.
    let cursor = at(2024, 1, 15);
    for (let i = 0; i < 36; i++) {
      const start = startOfHijriMonth(cursor);
      if (daysInHijriMonth(start) === 30) {
        const nextStart = addHijriMonths(start, 1);
        if (daysInHijriMonth(nextStart) === 29) {
          const thirtieth = endOfHijriMonth(start); // jour 30
          expect(toHijri(thirtieth).day).toBe(30);
          expect(toHijri(addHijriMonths(thirtieth, 1)).day).toBe(29);
          return;
        }
      }
      cursor = addHijriMonths(cursor, 1);
    }
    throw new Error('aucune paire 30/29 trouvee sur 3 ans — repere a revoir');
  });

  it('est neutre pour un decalage nul', () => {
    const date = at(2024, 3, 20);
    expect(addHijriMonths(date, 0)).toBe(date);
  });
});

describe('formatDayNumber', () => {
  it('rend le quantieme du calendrier de la langue', () => {
    const date = at(2024, 3, 11); // 1 Ramadan 1445
    expect(formatDayNumber(date, 'fr')).toBe('11');
    expect(formatDayNumber(date, 'ar')).toBe('1');
  });

  it('rend des chiffres latins en arabe — la grille aligne des tabular-nums', () => {
    expect(formatDayNumber(at(2024, 3, 20), 'ar')).toMatch(/^[0-9]+$/);
  });
});

describe('formatMonthYear', () => {
  it('rend le mois gregorien en francais', () => {
    expect(formatMonthYear(at(2024, 10, 15), 'fr')).toContain('2024');
  });

  it('rend le mois ET l annee hegiriens en arabe', () => {
    const label = formatMonthYear(at(2024, 10, 15), 'ar');
    expect(label).toContain('1446');
    expect(label).not.toContain('2024');
  });
});

describe('formatWeekdayShort', () => {
  it('abrege le jour dans la langue active', () => {
    const monday = at(2024, 10, 14);
    expect(formatWeekdayShort(monday, 'fr').toLowerCase()).toContain('lun');
    expect(formatWeekdayShort(monday, 'en').toLowerCase()).toContain('mon');
  });

  it('rend une forme etroite en arabe — un jour plein deborderait la colonne', () => {
    // « الاثنين » ferait six caracteres dans une colonne de 34 px.
    expect(formatWeekdayShort(at(2024, 10, 14), 'ar').length).toBeLessThanOrEqual(2);
  });
});

describe('isDisplayWeekend', () => {
  // Semaine du lundi 14 au dimanche 20 octobre 2024.
  const monday = at(2024, 10, 14);
  const thursday = at(2024, 10, 17);
  const friday = at(2024, 10, 18);
  const saturday = at(2024, 10, 19);
  const sunday = at(2024, 10, 20);

  it('chome samedi et dimanche en francais et en anglais', () => {
    for (const lng of ['fr', 'en']) {
      expect(isDisplayWeekend(saturday, lng)).toBe(true);
      expect(isDisplayWeekend(sunday, lng)).toBe(true);
      expect(isDisplayWeekend(friday, lng)).toBe(false);
      expect(isDisplayWeekend(monday, lng)).toBe(false);
    }
  });

  it('chome vendredi et samedi en arabe — le dimanche y ouvre la semaine', () => {
    expect(isDisplayWeekend(friday, 'ar')).toBe(true);
    expect(isDisplayWeekend(saturday, 'ar')).toBe(true);
    expect(isDisplayWeekend(sunday, 'ar')).toBe(false);
    expect(isDisplayWeekend(thursday, 'ar')).toBe(false);
  });
});

describe('weekStartsOnForLanguage', () => {
  it('ouvre la semaine le lundi partout, le dimanche en arabe seulement', () => {
    expect(weekStartsOnForLanguage('fr')).toBe(1);
    // `enUS` ouvre sa semaine le dimanche : s'en remettre aux options de la
    // locale ferait basculer l'anglais avec l'arabe. C'est une decision
    // produit, pas un reflet des locales.
    expect(weekStartsOnForLanguage('en')).toBe(1);
    expect(weekStartsOnForLanguage('ar')).toBe(0);
  });
});

describe('weekdayHeaders', () => {
  it('ordonne les colonnes depuis le lundi en francais, avec le week-end en queue', () => {
    const headers = weekdayHeaders('fr', 'narrow');
    expect(headers).toHaveLength(7);
    expect(headers[0].label).toBe('L');
    expect(headers.map((h) => h.weekend)).toEqual([
      false, false, false, false, false, true, true,
    ]);
  });

  it('ordonne les colonnes depuis le dimanche en arabe — vendredi-samedi en queue', () => {
    const headers = weekdayHeaders('ar');
    // L'ordre est verifiable sans ecrire de lettres arabes : le premier libelle
    // est celui d'un dimanche, les deux derniers ceux du vendredi et du samedi.
    expect(headers[0].label).toBe(formatWeekdayShort(at(2024, 10, 20), 'ar'));
    expect(headers[5].label).toBe(formatWeekdayShort(at(2024, 10, 18), 'ar'));
    expect(headers[6].label).toBe(formatWeekdayShort(at(2024, 10, 19), 'ar'));
    expect(headers.map((h) => h.weekend)).toEqual([
      false, false, false, false, false, true, true,
    ]);
  });

  it('n abrege jamais un jour arabe en toutes lettres — la colonne deborderait', () => {
    for (const header of weekdayHeaders('ar', 'short')) {
      expect(header.label.length).toBeLessThanOrEqual(2);
    }
  });
});
