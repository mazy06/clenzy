import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { isToday, daysBetween } from './utils/dateUtils';
import { TODAY_LINE_COLOR, TODAY_LINE_WIDTH } from './constants';

interface PlanningTodayLineProps {
  days: Date[];
  dayWidth: number;
  totalHeight: number;
}

const PlanningTodayLine: React.FC<PlanningTodayLineProps> = React.memo(({
  days,
  dayWidth,
  totalHeight,
}) => {
  const todayOffset = useMemo(() => {
    if (days.length === 0) return null;
    const todayIndex = days.findIndex((d) => isToday(d));
    if (todayIndex === -1) return null;

    // Position at current hour within the day
    const now = new Date();
    const hourFraction = (now.getHours() + now.getMinutes() / 60) / 24;
    return todayIndex * dayWidth + hourFraction * dayWidth;
  }, [days, dayWidth]);

  if (todayOffset === null) return null;

  return (
    <>
      {/* Trait vertical du jour (spec .pl-now : 2px #E5484D, z-6 — au-dessus
          des briques z-3/hover z-5) : ancré au conteneur des rangées, limité
          à la hauteur des logements affichés. */}
      <Box
        sx={{
          position: 'absolute',
          left: todayOffset,
          top: 0,
          width: TODAY_LINE_WIDTH,
          height: totalHeight,
          backgroundColor: TODAY_LINE_COLOR,
          zIndex: 6,
          pointerEvents: 'none',
        }}
      />
      {/* Point d'ancrage (spec .pl-now::before : 10px, top -1, left -4,
          halo 0 0 0 3px à 25 % d'alpha). Box séparée plutôt que ::before
          pour rester hors du clipping du trait. */}
      <Box
        sx={{
          position: 'absolute',
          left: todayOffset - 4,
          top: -1,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: TODAY_LINE_COLOR,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${TODAY_LINE_COLOR} 25%, transparent)`,
          zIndex: 6,
          pointerEvents: 'none',
        }}
      />
    </>
  );
});

PlanningTodayLine.displayName = 'PlanningTodayLine';
export default PlanningTodayLine;
