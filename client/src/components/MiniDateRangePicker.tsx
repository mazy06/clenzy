import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Typography, IconButton, alpha } from '@mui/material';
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
        <Box
          onClick={() => setSelectingField('start')}
          sx={{
            flex: 1,
            py: 0.5,
            px: 1,
            borderRadius: 1,
            border: '1px solid',
            borderColor: selectingField === 'start' ? 'primary.main' : 'divider',
            bgcolor: selectingField === 'start' ? (theme) => alpha(theme.palette.primary.main, 0.06) : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <span className="cn-text-caption text-muted-foreground text-[0.5625rem] block">
            {startLabel ?? defaultStartLabel}
          </span>
          <p className="cn-text-body2 font-semibold text-[0.75rem]">
            {startDate || '—'}
          </p>
        </Box>
        <Box
          onClick={() => setSelectingField('end')}
          sx={{
            flex: 1,
            py: 0.5,
            px: 1,
            borderRadius: 1,
            border: '1px solid',
            borderColor: selectingField === 'end' ? 'primary.main' : 'divider',
            bgcolor: selectingField === 'end' ? (theme) => alpha(theme.palette.primary.main, 0.06) : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <span className="cn-text-caption text-muted-foreground text-[0.5625rem] block">
            {endLabel ?? defaultEndLabel}
          </span>
          <p className="cn-text-body2 font-semibold text-[0.75rem]">
            {endDate || '—'}
          </p>
        </Box>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-center gap-0.5 mb-0.5">
        <IconButton
          size="small"
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          sx={{ p: 0.25 }}
        >
          <ChevronLeftIcon size={16} strokeWidth={1.75} />
        </IconButton>
        <span className="cn-text-caption font-semibold min-w-[90px] text-center capitalize text-[0.6875rem]">
          {formatMiniMonth(viewMonth, isFrench)}
        </span>
        <IconButton
          size="small"
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          sx={{ p: 0.25 }}
        >
          <ChevronRightIcon size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[repeat(7,_1fr)] gap-px">
        {dayHeaders.map((label, i) => (
          <div className="text-center py-0.5" key={`${label}-${i}`}>
            <span className="cn-text-caption font-semibold text-muted-foreground text-[0.5625rem]">
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
            <Box
              key={cell.dateStr}
              onClick={() => cell.inMonth && handleCellClick(cell.dateStr)}
              sx={{
                textAlign: 'center',
                py: 0.375,
                borderRadius: isStartDate ? '4px 0 0 4px' : isEndDate ? '0 4px 4px 0' : 0,
                cursor: cell.inMonth ? 'pointer' : 'default',
                opacity: cell.inMonth ? 1 : 0.25,
                bgcolor: isHighlighted
                  ? 'primary.main'
                  : inRange
                    ? (theme) => alpha(theme.palette.primary.main, 0.1)
                    : 'transparent',
                transition: 'background-color 0.1s',
                '&:hover': cell.inMonth && !isHighlighted
                  ? { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) }
                  : {},
              }}
            >
              <Typography
                variant="caption"
                fontWeight={isHighlighted ? 700 : 400}
                sx={{
                  fontSize: '0.625rem',
                  color: isHighlighted ? 'primary.contrastText' : 'text.primary',
                  lineHeight: 1.6,
                }}
              >
                {cell.date.getDate()}
              </Typography>
            </Box>
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
