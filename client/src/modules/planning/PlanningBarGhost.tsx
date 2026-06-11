import React from 'react';
import { Box, Typography } from '@mui/material';
import type { BarLayout } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { getEventDisplayColor } from './utils/colorUtils';

interface PlanningBarGhostProps {
  layout: BarLayout;
  isConflict: boolean;
}

const PlanningBarGhost: React.FC<PlanningBarGhostProps> = ({ layout, isConflict }) => {
  const { event, width, height } = layout;
  const eventColor = getEventDisplayColor(event);

  const borderColor = isConflict ? 'var(--err)' : 'var(--ok)';

  return (
    <Box
      sx={{
        width,
        height,
        backgroundColor: `color-mix(in srgb, ${eventColor} 25%, transparent)`,
        border: `2px solid ${borderColor}`,
        borderRadius: `${BAR_BORDER_RADIUS}px`,
        opacity: 0.8,
        display: 'flex',
        alignItems: 'center',
        px: 0.75,
        pointerEvents: 'none',
        overflow: 'hidden',
        ...(isConflict && {
          animation: 'ghost-pulse 1s ease-in-out infinite',
          '@keyframes ghost-pulse': {
            '0%, 100%': { opacity: 0.8 },
            '50%': { opacity: 0.5 },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }),
      }}
    >
      {width > 40 && (
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}
        >
          {event.label}
        </Typography>
      )}
    </Box>
  );
};

export default PlanningBarGhost;
