import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { PlanningProperty, DensityMode } from './types';
import { ROW_CONFIG } from './constants';
import { PropertyImageCarousel } from '../../components/PropertyImageCarousel';

interface PlanningPropertyColumnProps {
  properties: PlanningProperty[];
  density: DensityMode;
  selectedPropertyId?: number | null;
  colWidth: number;
  effectiveRowHeight: number;
  emptyRowCount?: number;
  onPropertyClick?: (propertyId: number) => void;
}

const PlanningPropertyColumn: React.FC<PlanningPropertyColumnProps> = React.memo(({
  properties,
  density,
  selectedPropertyId,
  colWidth,
  effectiveRowHeight,
  emptyRowCount = 0,
  onPropertyClick,
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
      {properties.map((property, idx) => {
        const showCarousel = colWidth >= 100;
        const nameHeight = density === 'compact' ? 14 : 18;
        const verticalPadding = 6;
        const carouselHeight = Math.max(
          24,
          effectiveRowHeight - nameHeight - verticalPadding,
        );
        return (
          <Box
            key={property.id}
            onClick={() => onPropertyClick?.(property.id)}
            sx={{
              height: effectiveRowHeight,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              gap: 0.25,
              p: 0,
              borderBottom: '1px solid',
              borderColor: 'divider',
              cursor: onPropertyClick ? 'pointer' : 'default',
              backgroundColor: selectedPropertyId === property.id
                ? theme.palette.mode === 'dark' ? 'rgba(107, 138, 154, 0.1)' : 'rgba(107, 138, 154, 0.05)'
                : idx % 2 === 0
                  ? 'transparent'
                  : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
              transition: 'background-color 0.15s ease',
              '&:hover': onPropertyClick ? {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(107, 138, 154, 0.15)' : 'rgba(107, 138, 154, 0.08)',
              } : {},
            }}
          >
            {showCarousel && (
              <PropertyImageCarousel
                photoUrls={property.photoUrls}
                alt={property.name}
                width="100%"
                height={carouselHeight}
                sx={{ width: '100%' }}
              />
            )}
            <Typography
              sx={{
                fontSize: density === 'compact' ? '0.6875rem' : '0.75rem',
                fontWeight: 400,
                color: 'text.secondary',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
                px: 0.75,
                pb: 0.5,
              }}
            >
              {property.name}
            </Typography>
          </Box>
        );
      })}
      {/* Empty filler rows */}
      {Array.from({ length: emptyRowCount }, (_, i) => (
        <Box
          key={`empty-${i}`}
          sx={{
            height: effectiveRowHeight,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: (properties.length + i) % 2 === 0
              ? 'transparent'
              : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
          }}
        />
      ))}
    </Box>
  );
});

PlanningPropertyColumn.displayName = 'PlanningPropertyColumn';
export default PlanningPropertyColumn;
