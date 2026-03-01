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
    <Box
      sx={{
        position: 'absolute',
        left: todayOffset,
        top: 0,
        width: TODAY_LINE_WIDTH,
        height: totalHeight,
        backgroundColor: TODAY_LINE_COLOR,
        zIndex: 8,
        pointerEvents: 'none',
        opacity: 0.7,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -4,
          left: -3,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: TODAY_LINE_COLOR,
        },
      }}
    />
  );
});

PlanningTodayLine.displayName = 'PlanningTodayLine';
export default PlanningTodayLine;
