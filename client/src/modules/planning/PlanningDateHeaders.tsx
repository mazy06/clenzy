import React, { useMemo } from 'react';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { isToday, isWeekend, formatMonthYear, formatDayNumber, formatFullDate } from './utils/dateUtils';
import { DATE_HEADER_HEIGHT } from './constants';
import type { ZoomLevel, MonthSeparator } from './types';

interface PlanningDateHeadersProps {
  days: Date[];
  dayWidth: number;
  zoom: ZoomLevel;
  totalGridWidth: number;
  propertyColWidth: number;
  propertyCount: number;
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
  propertyCount,
}) => {
  const theme = useTheme();
  const monthSeps = useMemo(() => computeMonthSeparators(days), [days]);

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
      <Box sx={{ display: 'flex', height: 20 }}>
        <Box
          sx={{
            width: propertyColWidth,
            minWidth: propertyColWidth,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            zIndex: 14,
            backgroundColor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            px: 1,
          }}
        >
          <Box
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: propertyColWidth < 130 ? '0.4375rem' : '0.5rem',
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {propertyCount} {propertyCount > 1 ? 'logements' : 'logement'}
          </Box>
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
                px: 0.75,
                backgroundColor: 'background.paper',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.5rem',
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

      {/* Day row : uniquement le numero de jour. Le nom complet
          (jour + numero + mois + annee) est revele au hover via Tooltip. */}
      <Box sx={{ display: 'flex', height: DATE_HEADER_HEIGHT - 20 }}>
        <Box
          sx={{
            width: propertyColWidth,
            minWidth: propertyColWidth,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            zIndex: 14,
            backgroundColor: 'background.paper',
          }}
        />
        <Box sx={{ display: 'flex', width: totalGridWidth }}>
          {days.map((day, idx) => {
            const today = isToday(day);
            const weekend = isWeekend(day);
            return (
              <Tooltip
                key={idx}
                title={formatFullDate(day)}
                placement="top"
                arrow
                enterDelay={250}
                enterNextDelay={100}
                slotProps={{
                  tooltip: {
                    sx: { textTransform: 'capitalize', fontSize: '0.6875rem' },
                  },
                }}
              >
                <Box
                  sx={{
                    width: dayWidth,
                    minWidth: dayWidth,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: today
                      ? theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)'
                      : weekend
                        ? theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                        : 'transparent',
                    cursor: 'default',
                    userSelect: 'none',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: dayWidth >= 60 ? '0.8125rem' : '0.6875rem',
                      fontWeight: today ? 700 : 500,
                      color: today ? 'error.main' : weekend ? 'text.disabled' : 'text.primary',
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatDayNumber(day)}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
});

PlanningDateHeaders.displayName = 'PlanningDateHeaders';
export default PlanningDateHeaders;
