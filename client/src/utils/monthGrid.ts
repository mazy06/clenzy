/**
 * La grille d'un mois : six rangees de sept jours, debordements compris.
 *
 * <p>Trois ecrans en avaient chacun leur copie — la grille mensuelle des tarifs
 * (`PricingCalendarView`), le mini selecteur de plage (`MiniDateRangePicker`) et
 * le calendrier de reservation (`ReservationRangeCalendar`). Trois fois le meme
 * calcul, trois fois le meme `toISO`, et trois fois le meme defaut : un debut de
 * semaine cale sur LUNDI en dur, quelle que soit la langue.</p>
 *
 * <p>La regle du debut de semaine vit dans `weekStartsOnForLanguage`
 * (`utils/localeDate`), les en-tetes de colonnes dans `weekdayHeaders` : les
 * trois grilles decoupent desormais la meme semaine, et l'arabe la commence au
 * dimanche pour que son week-end — vendredi, samedi — la FERME.</p>
 *
 * <p>La grille reste GREGORIENNE, y compris en arabe : elle est bornee par un
 * mois gregorien, qu'un nom de mois hegirien coifferait a faux puisqu'il en
 * couvre toujours deux. Seuls le decoupage et les libelles suivent la langue.</p>
 */

/** Un jour de la grille. `inMonth` distingue le mois affiche des debordements. */
export interface MonthGridCell {
  date: Date;
  /** `yyyy-MM-dd` en heure LOCALE — `toISOString` decalerait d'un jour. */
  dateStr: string;
  inMonth: boolean;
}

/** `yyyy-MM-dd` local, sans passer par UTC. */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Les cellules du mois de `month`, completees de part et d'autre pour remplir
 * des semaines entieres.
 *
 * @param weekStartsOn 0 = dimanche, 1 = lundi — cf. `weekStartsOnForLanguage`.
 */
export function buildMonthGrid(month: Date, weekStartsOn: 0 | 1): MonthGridCell[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);

  // Nombre de jours du mois PRECEDENT a poser avant le 1er.
  const lead = (firstDay.getDay() - weekStartsOn + 7) % 7;

  const cells: MonthGridCell[] = [];

  for (let i = lead - 1; i >= 0; i--) {
    const d = new Date(year, m, -i);
    cells.push({ date: d, dateStr: toLocalISODate(d), inMonth: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, m, day);
    cells.push({ date: d, dateStr: toLocalISODate(d), inMonth: true });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, m + 1, i);
      cells.push({ date: d, dateStr: toLocalISODate(d), inMonth: false });
    }
  }

  return cells;
}
