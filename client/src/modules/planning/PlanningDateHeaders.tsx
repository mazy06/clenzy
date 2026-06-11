import React, { useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { isToday, isWeekend, formatMonthYear, formatDayNumber, formatDayShort, formatFullDate } from './utils/dateUtils';
import { DATE_HEADER_HEIGHT, WEEKEND_HEADER_BG } from './constants';
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
        backgroundColor: 'var(--surface-2)',
        borderBottom: '1px solid var(--line)',
        minHeight: DATE_HEADER_HEIGHT,
      }}
    >
      {/* Coin « LOGEMENT » (spec .pl-corner) : cellule unique sur toute la
          hauteur de l'entête — padding 10px 16px, overline 10.5px fw700. */}
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
          padding: '10px 16px',
        }}
      >
        <Box
          component="span"
          sx={{
            fontWeight: 700,
            fontSize: '10.5px',
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

      <Box sx={{ display: 'flex', flexDirection: 'column', width: totalGridWidth }}>
      {/* Month row */}
      <Box sx={{ display: 'flex', height: 20 }}>
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

      {/* Day row (spec .pl-day : padding 8px 0, hairlines, dernier sans) :
          jour abrégé + numéro (aujourd'hui = carré accent 24×24).
          Le nom complet (jour + numero + mois + annee) reste au hover via Tooltip. */}
      <Box sx={{ display: 'flex', height: DATE_HEADER_HEIGHT - 20 }}>
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
                    py: '8px',
                    borderRight: '1px solid var(--line)',
                    // Spec .pl-day:last-child : pas de séparateur sur le dernier
                    '&:last-child': { borderRight: 0 },
                    // Spec .pl-day.we (constante locale --pl-day-we)
                    backgroundColor: today
                      ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
                      : weekend
                        ? WEEKEND_HEADER_BG
                        : 'transparent',
                    cursor: 'default',
                    userSelect: 'none',
                  }}
                >
                  {/* Jour abrégé (spec .wd : 9.5px fw700 .04em uppercase) */}
                  {dayWidth >= 34 && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: '9.5px',
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
                  {/* Numéro (spec .dn : Space Grotesk 14px fw600) —
                      aujourd'hui dans un carré accent 24×24 radius 8 */}
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: 600,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      ...(today
                        ? {
                            backgroundColor: 'var(--accent)',
                            color: 'var(--on-accent)',
                            width: 24,
                            height: 24,
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
    </Box>
  );
});

PlanningDateHeaders.displayName = 'PlanningDateHeaders';
export default PlanningDateHeaders;
