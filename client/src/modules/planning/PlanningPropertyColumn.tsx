import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { PlanningProperty, DensityMode } from './types';
import { ROW_CONFIG } from './constants';

interface PlanningPropertyColumnProps {
  properties: PlanningProperty[];
  density: DensityMode;
  selectedPropertyId?: number | null;
  colWidth: number;
  effectiveRowHeight: number;
}

const PlanningPropertyColumn: React.FC<PlanningPropertyColumnProps> = React.memo(({
  properties,
  density,
  selectedPropertyId,
  colWidth,
  effectiveRowHeight,
}) => {
  const theme = useTheme();
  const config = ROW_CONFIG[density];

  return (
    <Box
      sx={{
        position: 'sticky',
        left: 0,
        zIndex: 10,
        width: colWidth,
        minWidth: colWidth,
        flexShrink: 0,
        backgroundColor: 'background.paper',
        borderRight: '2px solid',
        borderColor: 'divider',
      }}
    >
      {properties.map((property, idx) => (
        <Box
          key={property.id}
          sx={{
            height: effectiveRowHeight,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: colWidth < 150 ? 1 : 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: selectedPropertyId === property.id
              ? theme.palette.mode === 'dark' ? 'rgba(107, 138, 154, 0.1)' : 'rgba(107, 138, 154, 0.05)'
              : idx % 2 === 0
                ? 'transparent'
                : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
            transition: 'background-color 0.15s ease',
          }}
        >
          <Typography
            sx={{
              fontSize: colWidth < 130
                ? '0.625rem'
                : density === 'compact' ? '0.6875rem' : '0.75rem',
              fontWeight: 600,
              color: 'text.primary',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}
          >
            {property.name}
          </Typography>
          {density === 'normal' && colWidth >= 140 && (
            <>
              {property.ownerName && (
                <Typography
                  sx={{
                    fontSize: colWidth < 160 ? '0.5rem' : '0.5625rem',
                    fontWeight: 500,
                    color: 'primary.main',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.01em',
                  }}
                >
                  {property.ownerName}
                </Typography>
              )}
              <Typography
                sx={{
                  fontSize: colWidth < 160 ? '0.5rem' : '0.5625rem',
                  fontWeight: 400,
                  color: 'text.secondary',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                }}
              >
                {property.city}
              </Typography>
            </>
          )}
        </Box>
      ))}
    </Box>
  );
});

PlanningPropertyColumn.displayName = 'PlanningPropertyColumn';
export default PlanningPropertyColumn;
