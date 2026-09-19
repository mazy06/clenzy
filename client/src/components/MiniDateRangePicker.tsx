import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '../utils/cn';
import { Button } from './ui';
import { ChevronPrev as ChevronPrevIcon, ChevronNext as ChevronNextIcon } from '../icons';
import { activeIntlLocaleGregorian } from '../utils/activeLocale';
import { useTranslation } from 'react-i18next';
import { weekdayHeaders, weekStartsOnForLanguage } from '../utils/localeDate';
import { buildMonthGrid } from '../utils/monthGrid';

// ─── Calendar Helpers ───────────────────────────────────────────────────────

// Le libellé de mois d'une grille GRÉGORIENNE : la langue suit l'utilisateur,
// le découpage reste celui de la grille. Un nom de mois hégirien coifferait
// ici une grille qui en couvre deux — c'est le piège que le planning évite en
// bornant sa fenêtre sur le mois affiché.
function formatMiniMonth(date: Date): string {
  return date.toLocaleDateString(activeIntlLocaleGregorian(), {
    month: 'short',
    year: 'numeric',
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface MiniDateRangePickerProps {
  startDate: string;
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
  startLabel?: string;
  endLabel?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

const MiniDateRangePicker: React.FC<MiniDateRangePickerProps> = ({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  startLabel,
  endLabel,
}) => {
  const { t, i18n } = useTranslation();
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

  // Le découpage de la semaine suit la LANGUE (lundi partout, dimanche en
  // arabe) : le mini calendrier partait du lundi en dur, y compris en arabe.
  const weekStartsOn = weekStartsOnForLanguage(i18n.language);
  const cells = useMemo(() => buildMonthGrid(viewMonth, weekStartsOn), [viewMonth, weekStartsOn]);

  // Initiales des jours ET leur ordre viennent de la langue (cf.
  // weekdayHeaders) : deux tableaux figés FR/EN laissaient l'arabe en anglais,
  // et l'ordre était celui d'une semaine commençant au lundi, en dur.
  const dayHeaders = useMemo(
    () => weekdayHeaders(i18n.language, 'narrow').map((header) => header.label),
    [i18n.language],
  );

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

  const isStart = (dateStr: string): boolean => dateStr === startDate;
  const isEnd = (dateStr: string): boolean => dateStr === endDate;

  const defaultStartLabel = t('common.start', 'Début');
  const defaultEndLabel = t('common.end', 'Fin');

  return (
    <div>
      {/* Selecting indicator */}
      <div className="flex gap-1.5 mb-1.5">
        {/* Le champ visé se dit par le FOND (bg-primary-soft) doublé d'une bordure
            de 1 px — pas par un liseré épais, proscrit par la charte. */}
        <div
          onClick={() => setSelectingField('start')}
          className={cn(
            'flex-1 py-[3px] px-[6px] rounded-md border border-solid cursor-pointer transition-colors duration-150',
            selectingField === 'start'
              ? 'border-primary bg-primary-soft'
              : 'border-border bg-transparent',
          )}
        >
          <span className="block text-[0.5625rem] text-muted-foreground">
            {startLabel ?? defaultStartLabel}
          </span>
          <p className="text-xs font-semibold tabular-nums">
            {startDate || '—'}
          </p>
        </div>
        <div
          onClick={() => setSelectingField('end')}
          className={cn(
            'flex-1 py-[3px] px-[6px] rounded-md border border-solid cursor-pointer transition-colors duration-150',
            selectingField === 'end'
              ? 'border-primary bg-primary-soft'
              : 'border-border bg-transparent',
          )}
        >
          <span className="block text-[0.5625rem] text-muted-foreground">
            {endLabel ?? defaultEndLabel}
          </span>
          <p className="text-xs font-semibold tabular-nums">
            {endDate || '—'}
          </p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-center gap-0.5 mb-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('common.previousMonth', 'Mois précédent')}
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
        >
          <ChevronPrevIcon size={16} strokeWidth={1.75} />
        </Button>
        <span className="min-w-[90px] text-center text-[0.6875rem] font-semibold capitalize">
          {formatMiniMonth(viewMonth)}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('common.nextMonth', 'Mois suivant')}
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
        >
          <ChevronNextIcon size={16} strokeWidth={1.75} />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[repeat(7,_1fr)] gap-px">
        {dayHeaders.map((label, i) => (
          <div className="text-center py-0.5" key={`${label}-${i}`}>
            <span className="text-[0.5625rem] font-semibold text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-[repeat(7,_1fr)] gap-px">
        {cells.map((cell) => {
          const inRange = isInRange(cell.dateStr);
          const isStartDate = isStart(cell.dateStr);
          const isEndDate = isEnd(cell.dateStr);
          const isHighlighted = isStartDate || isEndDate;

          return (
            <div
              key={cell.dateStr}
              onClick={() => cell.inMonth && handleCellClick(cell.dateStr)}
              className={cn(
                'text-center py-[2.25px] transition-[background-color] duration-100',
                // Rayons LOGIQUES : le PMS est aussi rendu en RTL, où le début de
                // plage doit s'arrondir à droite.
                isStartDate ? 'rounded-s-[4px] rounded-e-none' : isEndDate ? 'rounded-e-[4px] rounded-s-none' : 'rounded-none',
                cell.inMonth ? 'cursor-pointer opacity-100' : 'cursor-default opacity-25',
                isHighlighted
                  ? 'bg-primary'
                  : inRange
                    ? 'bg-primary-soft'
                    : 'bg-transparent',
                cell.inMonth && !isHighlighted && 'hover:bg-muted',
              )}
            >
              {/* Bornes de la plage : aplat plein de la teinte de marque, donc
                  encre `primary-foreground` (le couple garanti lisible dans les
                  deux thèmes Baitly UI). */}
              <span
                className={cn(
                  'text-[0.625rem] leading-[1.6] tabular-nums',
                  isHighlighted ? 'font-bold text-primary-foreground' : 'font-normal text-foreground',
                )}
              >
                {cell.date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Clear button */}
      {(startDate || endDate) && (
        <div className="text-end mt-0.5">
          {/* Reinitialisation discrete sous le calendrier : tertiaire. */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              onChangeStart('');
              onChangeEnd('');
              setSelectingField('start');
            }}
          >
            {t('common.clear', 'Effacer')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MiniDateRangePicker;
