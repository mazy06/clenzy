import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '../utils/cn';
import { Button } from './ui';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '../icons';

// ─── Calendar Helpers ───────────────────────────────────────────────────────

interface MiniCalendarCell {
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

function buildMiniGrid(month: Date): MiniCalendarCell[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: MiniCalendarCell[] = [];

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

function formatMiniMonth(date: Date, isFrench: boolean): string {
  return date.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
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
  isFrench: boolean;
  startLabel?: string;
  endLabel?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

const MiniDateRangePicker: React.FC<MiniDateRangePickerProps> = ({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  isFrench,
  startLabel,
  endLabel,
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

  const cells = useMemo(() => buildMiniGrid(viewMonth), [viewMonth]);

  const dayHeaders = isFrench
    ? ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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

  const defaultStartLabel = isFrench ? 'Début' : 'Start';
  const defaultEndLabel = isFrench ? 'Fin' : 'End';

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
          aria-label={isFrench ? 'Mois précédent' : 'Previous month'}
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
        >
          <ChevronLeftIcon size={16} strokeWidth={1.75} />
        </Button>
        <span className="min-w-[90px] text-center text-[0.6875rem] font-semibold capitalize">
          {formatMiniMonth(viewMonth, isFrench)}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={isFrench ? 'Mois suivant' : 'Next month'}
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
        >
          <ChevronRightIcon size={16} strokeWidth={1.75} />
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
            {isFrench ? 'Effacer' : 'Clear'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MiniDateRangePicker;
