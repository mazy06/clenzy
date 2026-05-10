import React from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { ChevronLeft, ChevronRight } from '../../../icons';
import type { ResolvedTokens, PreviewAvailabilityDay } from '../types/bookingEngine';
import { getMonthGrid, fmt } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';

interface BookingCalendarProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  calMonth: { year: number; month: number };
  setCalMonth: (val: { year: number; month: number }) => void;
  checkIn: string | null;
  checkOut: string | null;
  hoverDate: string | null;
  setHoverDate: (d: string | null) => void;
  handleDayClick: (dateStr: string) => void;
  selectedTypes: string[];
  availabilityDays?: Map<string, PreviewAvailabilityDay>;
  availabilityLoading?: boolean;
  defaultCurrency: string;
  isCompact: boolean;
  /** Dates before this YYYY-MM-DD are non-bookable (grayed out) */
  minBookableDate?: string;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  tk, i18n, calMonth, setCalMonth, checkIn, checkOut,
  hoverDate, setHoverDate, handleDayClick, selectedTypes,
  availabilityDays, availabilityLoading, defaultCurrency, isCompact, minBookableDate,
}) => {
  if (availabilityLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: tk.primary }} />
      </Box>
    );
  }

  const { year, month } = calMonth;
  const nextMonth = new Date(year, month + 1, 1);

  return (
    <Box sx={{ p: 1 }}>
      {/* Navigation arrows */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <IconButton size="small" onClick={() => {
          const prev = new Date(year, month - 1, 1);
          setCalMonth({ year: prev.getFullYear(), month: prev.getMonth() });
        }} sx={{
          color: tk.surface, bgcolor: tk.primary, width: 28, height: 28,
          '&:hover': { bgcolor: tk.primary, filter: 'brightness(1.1)' },
        }}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </IconButton>
        <IconButton size="small" onClick={() => {
          const next = new Date(year, month + 1, 1);
          setCalMonth({ year: next.getFullYear(), month: next.getMonth() });
        }} sx={{
          color: tk.surface, bgcolor: tk.primary, width: 28, height: 28,
          '&:hover': { bgcolor: tk.primary, filter: 'brightness(1.1)' },
        }}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </IconButton>
      </Box>

      {/* Month grids */}
      <Box sx={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: isCompact ? 0 : 3 }}>
        <SingleMonth
          year={year} month={month} tk={tk} i18n={i18n}
          checkIn={checkIn} checkOut={checkOut} hoverDate={hoverDate}
          setHoverDate={setHoverDate} handleDayClick={handleDayClick}
          selectedTypes={selectedTypes} availabilityDays={availabilityDays}
          defaultCurrency={defaultCurrency}
        />
        {!isCompact && (
          <SingleMonth
            year={nextMonth.getFullYear()} month={nextMonth.getMonth()} tk={tk} i18n={i18n}
            checkIn={checkIn} checkOut={checkOut} hoverDate={hoverDate}
            setHoverDate={setHoverDate} handleDayClick={handleDayClick}
            selectedTypes={selectedTypes} availabilityDays={availabilityDays}
            defaultCurrency={defaultCurrency}
          />
        )}
      </Box>
    </Box>
  );
};

// ─── SingleMonth (internal) ─────────────────────────────────────────────────

interface SingleMonthProps {
  year: number;
  month: number;
  tk: ResolvedTokens;
  i18n: BookingI18n;
  checkIn: string | null;
  checkOut: string | null;
  hoverDate: string | null;
  setHoverDate: (d: string | null) => void;
  handleDayClick: (dateStr: string) => void;
  selectedTypes: string[];
  availabilityDays?: Map<string, PreviewAvailabilityDay>;
  defaultCurrency: string;
}

const SingleMonth: React.FC<SingleMonthProps> = ({
  year, month, tk, i18n, checkIn, checkOut, hoverDate,
  setHoverDate, handleDayClick, selectedTypes,
  availabilityDays, defaultCurrency,
}) => {
  const { daysInMonth, offset } = getMonthGrid(year, month);
  const monthNames = i18n.tArray('months');
  const weekdays = i18n.tArray('weekdays');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rangeEnd = checkIn && !checkOut && hoverDate && hoverDate > checkIn ? hoverDate : checkOut;

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{
        fontFamily: tk.headingFont, fontWeight: 700, fontSize: 12, color: tk.text,
        textAlign: 'center', mb: 0.5,
      }}>
        {monthNames[month]} {year}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, mb: 0.5 }}>
        {weekdays.map((d, i) => (
          <Typography key={i} sx={{
            textAlign: 'center', fontSize: 9, fontWeight: 600, color: tk.textLabel, py: 0.25,
          }}>
            {d}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
        {Array.from({ length: offset }).map((_, i) => <Box key={`e-${i}`} sx={{ py: '3px' }} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const cellDate = new Date(year, month, day);
          const isPast = cellDate < today;
          const dayData = availabilityDays?.get(dateStr);
          const isUnavailable = dayData ? !dayData.available : false;
          const noMatchingTypes = selectedTypes.length > 0 && dayData
            ? !dayData.availableTypes.some(t => selectedTypes.includes(t))
            : false;
          const disabled = isPast || isUnavailable || noMatchingTypes;
          const isToday = cellDate.getTime() === today.getTime();
          const isCheckIn = checkIn === dateStr;
          const isCheckOut = (checkOut || (hoverDate && !checkOut)) && dateStr === rangeEnd;
          const isEndpoint = isCheckIn || isCheckOut;
          const inRange = checkIn && rangeEnd && dateStr > checkIn && dateStr < rangeEnd;
          const isHoverRange = !checkOut && checkIn && hoverDate && hoverDate > checkIn
            && dateStr > checkIn && dateStr <= hoverDate;

          return (
            <Box
              key={day}
              onClick={() => !disabled && handleDayClick(dateStr)}
              onMouseEnter={() => !disabled && setHoverDate(dateStr)}
              onMouseLeave={() => setHoverDate(null)}
              sx={{
                textAlign: 'center', py: '3px', cursor: disabled ? 'default' : 'pointer',
                position: 'relative',
                bgcolor: isEndpoint
                  ? tk.primary
                  : (inRange || isHoverRange)
                    ? checkOut ? `${tk.primary}18` : `${tk.primary}10`
                    : 'transparent',
                borderRadius: isCheckIn
                  ? `${tk.radiusSm} 0 0 ${tk.radiusSm}`
                  : isCheckOut
                    ? `0 ${tk.radiusSm} ${tk.radiusSm} 0`
                    : 0,
                color: isEndpoint ? '#fff' : disabled ? `${tk.textLabel}60` : tk.text,
                fontSize: 12, fontWeight: isToday || isEndpoint ? 700 : 500,
                opacity: disabled ? 0.4 : 1,
                transition: 'background-color 0.15s ease',
                '&:hover': !disabled && !isEndpoint ? {
                  bgcolor: (inRange || isHoverRange) ? `${tk.primary}25` : `${tk.primary}08`,
                } : {},
              }}
            >
              <Box sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: 28,
              }}>
                <Typography component="span" sx={{
                  fontSize: 11, fontWeight: isToday || isEndpoint ? 700 : 500,
                  color: 'inherit',
                  textDecoration: disabled ? 'line-through' : 'none',
                }}>
                  {day}
                </Typography>
                {dayData?.minPrice != null && !disabled && !isCheckOut && (
                  <Typography sx={{
                    fontSize: 8, lineHeight: 1, mt: 0.25,
                    color: isEndpoint ? 'rgba(255,255,255,0.75)' : tk.primary,
                    fontWeight: 600,
                  }}>
                    {fmt(dayData.minPrice, defaultCurrency)}
                  </Typography>
                )}
                {isToday && !isEndpoint && (
                  <Box sx={{
                    width: 4, height: 4, borderRadius: '50%', bgcolor: tk.primary,
                    position: 'absolute', bottom: 3,
                  }} />
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default BookingCalendar;
