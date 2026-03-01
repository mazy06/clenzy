import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { BarLayout } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { hexToRgba } from './utils/colorUtils';

interface PlanningBarGhostProps {
  layout: BarLayout;
  isConflict: boolean;
}

const PlanningBarGhost: React.FC<PlanningBarGhostProps> = ({ layout, isConflict }) => {
  const theme = useTheme();
  const { event, width, height } = layout;
  const isDark = theme.palette.mode === 'dark';

  const borderColor = isConflict
    ? theme.palette.error.main
    : theme.palette.success.main;

  return (
    <Box
      sx={{
        width,
        height,
        backgroundColor: hexToRgba(event.color, isDark ? 0.3 : 0.2),
        border: `2px solid ${borderColor}`,
        borderLeft: `3px solid ${borderColor}`,
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
        }),
      }}
    >
      {width > 40 && (
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: isDark ? 'text.primary' : event.color,
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
