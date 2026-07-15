import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { isToday, isWeekend, formatDayNumber, formatDayShort, formatFullDate } from './utils/dateUtils';
import { DATE_HEADER_HEIGHT, WEEKEND_HEADER_BG } from './constants';
import type { ZoomLevel } from './types';

interface PlanningDateHeadersProps {
  days: Date[];
  dayWidth: number;
  zoom: ZoomLevel;
  totalGridWidth: number;
  propertyColWidth: number;
  propertyCount: number;
}

const PlanningDateHeaders: React.FC<PlanningDateHeadersProps> = React.memo(({
  days,
  dayWidth,
  zoom,
  totalGridWidth,
  propertyColWidth,
  propertyCount,
}) => {
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

      {/* Day row (spec .pl-day : padding 8px 0, hairlines, dernier sans) :
          jour abrégé + numéro (aujourd'hui = carré accent 24×24).
          Le mois/année vit dans la toolbar (sélecteur ‹ Mois Année ›, suivi du
          scroll) — plus de rangée mois dans la grille. Le nom complet
          (jour + numero + mois + annee) reste au hover via Tooltip. */}
      <Box sx={{ display: 'flex', height: DATE_HEADER_HEIGHT, width: totalGridWidth }}>
          {days.map((day) => {
            const today = isToday(day);
            const weekend = isWeekend(day);
            return (
              <Tooltip
                key={day.getTime()}
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
                    // Spec .pl-day.we (constante locale --pl-day-we) —
                    // la référence ne teinte PAS la cellule « aujourd'hui »
                    backgroundColor: weekend ? WEEKEND_HEADER_BG : 'transparent',
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
                            // Spec .dn : var(--body), week-end inclus
                            color: 'var(--body)',
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
  );
});

PlanningDateHeaders.displayName = 'PlanningDateHeaders';
export default PlanningDateHeaders;
