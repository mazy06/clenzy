import React, { useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { isToday, isWeekend, formatMonthYear, formatDayNumber, formatDayShort, formatFullDate } from './utils/dateUtils';
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
  const monthSeps = useMemo(() => computeMonthSeparators(days), [days]);

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--surface-2)',
        borderBottom: '1px solid var(--line)',
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
            backgroundColor: 'var(--surface-2)',
            borderRight: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            px: 1,
          }}
        >
          {/* Colonne LOGEMENT en overline (maquette) + compteur existant */}
          <Box
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: propertyColWidth < 130 ? '0.5rem' : '0.59375rem',
              color: 'var(--faint)',
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
                backgroundColor: 'var(--surface-2)',
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.5625rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  color: 'var(--ink)',
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

      {/* Day row : jour abrégé + numéro (aujourd'hui = pastille accent).
          Le nom complet (jour + numero + mois + annee) reste au hover via Tooltip. */}
      <Box sx={{ display: 'flex', height: DATE_HEADER_HEIGHT - 20 }}>
        <Box
          sx={{
            width: propertyColWidth,
            minWidth: propertyColWidth,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            zIndex: 14,
            backgroundColor: 'var(--surface-2)',
            borderRight: '1px solid var(--line)',
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
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1px',
                    borderRight: '1px solid var(--line)',
                    backgroundColor: today
                      ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
                      : weekend
                        ? 'color-mix(in srgb, var(--ink) 2.5%, transparent)'
                        : 'transparent',
                    cursor: 'default',
                    userSelect: 'none',
                  }}
                >
                  {/* Jour abrégé (overline) */}
                  {dayWidth >= 34 && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.5625rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        lineHeight: 1,
                        color: today ? 'var(--accent)' : 'var(--faint)',
                      }}
                    >
                      {formatDayShort(day).replace('.', '')}
                    </Box>
                  )}
                  {/* Numéro — aujourd'hui dans une pastille accent */}
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-display)',
                      fontSize: dayWidth >= 60 ? '0.8125rem' : '0.6875rem',
                      fontWeight: 600,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      ...(today
                        ? {
                            backgroundColor: 'var(--accent)',
                            color: 'var(--on-accent)',
                            width: 22,
                            height: 22,
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }
                        : {
                            color: weekend ? 'var(--faint)' : 'var(--body)',
                          }),
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
