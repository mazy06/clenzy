import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { useMediaQuery } from '../../hooks/use-media-query';
import { ChevronLeft, ChevronRight, NightsStay } from '../../icons';

// ─── Calendrier range « Signature » (.rm-cal) ───────────────────────────────
// Extrait de PlanningQuickCreateDialog pour être partagé par ReservationDialog.
// Comportement : sélection début → fin, reset si fin < début, Effacer. Look
// maquette « Signature » : grille 7 col gap 3, jours aspect 1, in-range
// accent-soft sans radius, edges accent blanc. Tokens var(--…).

interface CalCell {
  date: Date;
  dateStr: string;
  inMonth: boolean;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildCalGrid(month: Date): CalCell[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: CalCell[] = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, m, -i);
    cells.push({ date: d, dateStr: toISO(d), inMonth: false });
  }
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, m, day);
    cells.push({ date: d, dateStr: toISO(d), inMonth: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, m + 1, i);
      cells.push({ date: d, dateStr: toISO(d), inMonth: false });
    }
  }
  return cells;
}

const DEFAULT_WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const CAL_NAV_BTN_CLS =
  'w-[28px] h-[28px] rounded-[8px] border border-solid border-[var(--line-2)] bg-[var(--card)] ' +
  'text-[var(--muted)] cursor-pointer flex items-center justify-center p-0 ' +
  'transition-[color,border-color] duration-[140ms] hover:text-[var(--accent)] hover:border-[var(--accent)] ' +
  'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[1px]';

const CLEAR_LINK_CLS =
  'inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--accent)] cursor-pointer ' +
  'bg-transparent border-0 p-0 [font-family:inherit] ' +
  'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2';

/** Champ date flottant cliquable (Arrivée / Départ) — affichage + cible de sélection. */
const FloatDateField: React.FC<{
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, value, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'relative w-full h-[44px] rounded-[11px] border border-solid flex items-center px-[13px]',
      '[font-family:inherit] text-[13.5px] cursor-pointer text-left tabular-nums',
      'transition-[border-color,box-shadow,background-color] duration-[140ms]',
      'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
      active
        ? 'bg-[var(--card)] border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]'
        : 'bg-[var(--field)] border-[var(--field-line)] shadow-none',
      value ? 'font-semibold text-[var(--ink)]' : 'font-medium text-[var(--faint)]',
    )}
  >
    <span className="absolute -top-[7px] start-[12px] bg-[var(--card)] px-[5px] text-[10.5px] font-semibold text-[var(--muted)] leading-[14px] whitespace-nowrap">
      {label}
    </span>
    {value || '—'}
  </button>
);

export interface ReservationRangeCalendarProps {
  startDate: string;
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
  /** Nombre de nuits (affiché dans la ligne sous le calendrier). */
  nights: number;
  /** Libellés i18n. */
  arrivalLabel: string;
  departureLabel: string;
  clearLabel: string;
  /** Texte « N nuits » déjà formaté (pluralisation gérée par le parent). */
  nightsText: string;
  prevMonthLabel: string;
  nextMonthLabel: string;
  /** Locale pour le libellé du mois (ex. 'fr-FR', 'en-US', 'ar'). */
  locale: string;
  /** 7 initiales de jours (Lun→Dim). */
  weekdayLabels?: string[];
}

const ReservationRangeCalendar: React.FC<ReservationRangeCalendarProps> = ({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  nights,
  arrivalLabel,
  departureLabel,
  clearLabel,
  nightsText,
  prevMonthLabel,
  nextMonthLabel,
  locale,
  weekdayLabels = DEFAULT_WEEKDAYS,
}) => {
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  // Sync displayed month when startDate prop changes (e.g. set by parent after mount)
  useEffect(() => {
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      setViewMonth((prev) => {
        if (prev.getFullYear() === y && prev.getMonth() === m - 1) return prev;
        return new Date(y, m - 1, 1);
      });
    }
  }, [startDate]);

  const [selectingField, setSelectingField] = useState<'start' | 'end'>('start');

  // Deux mois côte à côte (mois courant + suivant) ; repli à un seul mois si étroit.
  const singleMonth = useMediaQuery('(max-width: 760px)');
  const secondMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    [viewMonth],
  );
  const cells1 = useMemo(() => buildCalGrid(viewMonth), [viewMonth]);
  const cells2 = useMemo(() => buildCalGrid(secondMonth), [secondMonth]);

  const handleCellClick = useCallback(
    (dateStr: string) => {
      if (selectingField === 'start') {
        onChangeStart(dateStr);
        if (endDate && dateStr > endDate) {
          onChangeEnd('');
        }
        setSelectingField('end');
      } else {
        if (startDate && dateStr < startDate) {
          onChangeStart(dateStr);
          onChangeEnd('');
          setSelectingField('end');
        } else {
          onChangeEnd(dateStr);
          setSelectingField('start');
        }
      }
    },
    [selectingField, startDate, endDate, onChangeStart, onChangeEnd],
  );

  const isInRange = useCallback(
    (dateStr: string): boolean => {
      if (!startDate || !endDate) return false;
      return dateStr >= startDate && dateStr <= endDate;
    },
    [startDate, endDate],
  );

  const fmtMonth = (d: Date) => d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  // Rend UN mois : libellé + en-tête jours + grille 7 colonnes. La plage (edges /
  // in-range) fonctionne à cheval sur les deux mois via les mêmes handlers.
  const renderMonth = (cells: CalCell[], label: string) => (
    <div className="flex-1 min-w-0">
      <b className="block [font-family:var(--font-display)] text-[14px] font-semibold text-[var(--ink)] text-center capitalize mb-[6px]">
        {label}
      </b>
      <div className="grid grid-cols-[repeat(7,_1fr)] gap-[3px]">
        {weekdayLabels.map((wl, i) => (
          <div key={`${wl}-${i}`} className="text-center text-[10.5px] font-bold text-[var(--faint)] py-[4px]">
            {wl}
          </div>
        ))}
        {cells.map((cell) => {
          // Jours des mois adjacents : cellule vide (garde l'alignement 7 colonnes),
          // pas de numéro ni de surbrillance — ils n'appartiennent pas à ce mois.
          if (!cell.inMonth) return <div className="aspect-[1]" key={cell.dateStr} aria-hidden />;

          const isStart = cell.dateStr === startDate;
          const isEnd = cell.dateStr === endDate;
          const edge = isStart || isEnd;
          const inRange = !edge && isInRange(cell.dateStr);

          return (
            // `cell.inMonth` est garanti vrai ici (retour anticipe ci-dessus) :
            // les branches `inMonth ? … : …` de l'ancien sx sont resolues.
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => handleCellClick(cell.dateStr)}
              className={cn(
                'aspect-[1] flex items-center justify-center border-0 p-0',
                '[font-family:var(--font-display)] text-[13px] font-semibold tabular-nums',
                'cursor-pointer select-none transition-[background,color] duration-[120ms]',
                'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
                edge && 'text-[var(--on-accent)] bg-[var(--accent)]',
                inRange && 'text-[var(--accent)] bg-[var(--accent-soft)] rounded-none',
                !edge && !inRange && 'text-[var(--body)] bg-transparent rounded-[9px] hover:bg-[var(--hover)]',
                edge && isStart && isEnd && 'rounded-[9px]',
                edge && isStart && !isEnd && 'rounded-l-[9px] rounded-r-none',
                edge && !isStart && 'rounded-r-[9px] rounded-l-none',
              )}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Champs Arrivée / Départ (cibles de sélection) */}
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <FloatDateField
          label={arrivalLabel}
          value={startDate}
          active={selectingField === 'start'}
          onClick={() => setSelectingField('start')}
        />
        <FloatDateField
          label={departureLabel}
          value={endDate}
          active={selectingField === 'end'}
          onClick={() => setSelectingField('end')}
        />
      </div>

      <div>
        {/* Navigation : décale la paire de mois. Chevrons aux extrémités (style Airbnb). */}
        <div className="relative min-h-[28px] mb-[2px]">
          <button
            type="button"
            aria-label={prevMonthLabel}
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className={cn(CAL_NAV_BTN_CLS, 'absolute start-0 top-0')}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label={nextMonthLabel}
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className={cn(CAL_NAV_BTN_CLS, 'absolute end-0 top-0')}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </button>
        </div>

        {/* Un ou deux mois côte à côte */}
        <div className={cn('grid gap-7', singleMonth ? 'grid-cols-[1fr]' : 'grid-cols-[1fr_1fr]')}>
          {renderMonth(cells1, fmtMonth(viewMonth))}
          {!singleMonth && renderMonth(cells2, fmtMonth(secondMonth))}
        </div>

        {/* Nuits + Effacer */}
        {(startDate || endDate) && (
          <div className="flex items-center justify-between mt-2">
            {nights > 0 ? (
              <div className="inline-flex items-center gap-[5px] text-[12px] font-semibold text-[var(--muted)] tabular-nums">
                <NightsStay size={13} strokeWidth={1.75} />
                {nightsText}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => {
                onChangeStart('');
                onChangeEnd('');
                setSelectingField('start');
              }}
              className={CLEAR_LINK_CLS}
            >
              {clearLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservationRangeCalendar;
