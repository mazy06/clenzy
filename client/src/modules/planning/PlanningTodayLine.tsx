import React, { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { isToday } from './utils/dateUtils';
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
  // Recalage chaque minute (spec JS placeNow : setInterval 60 000 ms,
  // cleanup à l'unmount) — le trait suit l'heure courante sans reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const todayOffset = useMemo(() => {
    if (days.length === 0) return null;
    const todayIndex = days.findIndex((d) => isToday(d));
    if (todayIndex === -1) return null;

    // Équivalent du calc(188px + (100% − 188px) × fraction) de la spec : le
    // conteneur des rangées démarre déjà après la colonne logements, d'où
    // left = (todayIdx + heure/24) × dayWidth.
    const hourFraction = (now.getHours() + now.getMinutes() / 60) / 24;
    return todayIndex * dayWidth + hourFraction * dayWidth;
  }, [days, dayWidth, now]);

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
