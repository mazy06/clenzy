import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { isToday, isWeekend, isSameMonth, formatMonthYear, formatDayNumber, formatDayShort } from './utils/dateUtils';
import { DATE_HEADER_HEIGHT } from './constants';
import type { ZoomLevel, MonthSeparator } from './types';

interface PlanningDateHeadersProps {
  days: Date[];
  dayWidth: number;
  zoom: ZoomLevel;
  totalGridWidth: number;
  propertyColWidth: number;
}

function computeMonthSeparators(days: Date[]): MonthSeparator[] {
  if (days.length === 0) return [];
  const seps: MonthSeparator[] = [];
  let currentMonth = -1;
  let currentYear = -1;

  for (let i = 0; i < days.length; i++) {
    const m = days[i].getMonth();
    const y = days[i].getFullYear();
    if (m !== currentMonth || y !== currentYear) {
      seps.push({
        month: m,
        year: y,
        label: formatMonthYear(days[i]),
        startIndex: i,
        count: 1,
      });
      currentMonth = m;
      currentYear = y;
    } else {
      seps[seps.length - 1].count++;
    }
  }
  return seps;
}

const PlanningDateHeaders: React.FC<PlanningDateHeadersProps> = React.memo(({
  days,
  dayWidth,
  zoom,
  totalGridWidth,
  propertyColWidth,
}) => {
  const theme = useTheme();
  const monthSeps = useMemo(() => computeMonthSeparators(days), [days]);
  const showDayNames = true;
  const showDayNumbers = true;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        borderBottom: '2px solid',
        borderColor: 'divider',
        minHeight: DATE_HEADER_HEIGHT,
      }}
    >
      {/* Month row */}
      <Box sx={{ display: 'flex', height: 28 }}>
        <Box
          sx={{
            width: propertyColWidth,
            minWidth: propertyColWidth,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            zIndex: 14,
            backgroundColor: 'background.paper',
            borderRight: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: propertyColWidth < 150 ? '0.5625rem' : '0.6875rem',
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Logements
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', width: totalGridWidth }}>
          {monthSeps.map((sep) => (
            <Box
              key={`${sep.year}-${sep.month}`}
              sx={{
                width: sep.count * dayWidth,
                minWidth: sep.count * dayWidth,
                display: 'flex',
                alignItems: 'center',
                px: 1,
                borderRight: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  color: 'text.primary',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sep.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Day row */}
      {showDayNumbers && (
        <Box sx={{ display: 'flex', height: DATE_HEADER_HEIGHT - 28 }}>
          <Box
            sx={{
              width: propertyColWidth,
              minWidth: propertyColWidth,
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 14,
              backgroundColor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
            }}
          />
          <Box sx={{ display: 'flex', width: totalGridWidth }}>
            {days.map((day, idx) => {
              const today = isToday(day);
              const weekend = isWeekend(day);
              return (
                <Box
                  key={idx}
                  sx={{
                    width: dayWidth,
                    minWidth: dayWidth,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: today
                      ? theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)'
                      : weekend
                        ? theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                        : 'transparent',
                    cursor: 'default',
                    userSelect: 'none',
                  }}
                >
                  {showDayNames && dayWidth >= 30 && (
                    <Typography
                      sx={{
                        fontSize: dayWidth >= 60 ? '0.5625rem' : '0.5rem',
                        fontWeight: today ? 700 : 400,
                        color: today ? 'error.main' : weekend ? 'text.disabled' : 'text.secondary',
                        lineHeight: 1,
                        textTransform: 'capitalize',
                      }}
                    >
                      {formatDayShort(day).slice(0, dayWidth >= 60 ? 3 : 1)}
                    </Typography>
                  )}
                  <Typography
                    sx={{
                      fontSize: dayWidth >= 60 ? '0.75rem' : '0.625rem',
                      fontWeight: today ? 800 : 600,
                      color: today ? 'error.main' : weekend ? 'text.disabled' : 'text.primary',
                      lineHeight: 1.2,
                    }}
                  >
                    {formatDayNumber(day)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
});

PlanningDateHeaders.displayName = 'PlanningDateHeaders';
export default PlanningDateHeaders;
