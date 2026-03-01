import React, { useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import PlanningBar from './PlanningBar';
import type { BarLayout, PlanningEvent, PlanningProperty, DensityMode, ZoomLevel, QuickCreateData, PlanningDragState } from './types';
import { ROW_CONFIG, PRICE_LINE_HEIGHT } from './constants';
import { isWeekend, isToday, toDateStr } from './utils/dateUtils';
import type { PricingMap } from './hooks/usePlanningPricing';

// ─── Price formatter ────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (Number.isInteger(price)) return `${price}\u20AC`;
  return `${price.toFixed(1)}\u20AC`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlanningRowProps {
  property: PlanningProperty;
  barLayouts: BarLayout[];
  days: Date[];
  dayWidth: number;
  density: DensityMode;
  zoom: ZoomLevel;
  totalGridWidth: number;
  rowIndex: number;
  selectedEventId: string | null;
  conflictEventIds: Set<string>;
  isDragging: boolean;
  dragState: PlanningDragState;
  onEventClick: (event: PlanningEvent) => void;
  onEmptyClick: (data: QuickCreateData) => void;
  showPrices: boolean;
  pricingMap: PricingMap;
  effectiveRowHeight: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PlanningRow: React.FC<PlanningRowProps> = React.memo(({
  property,
  barLayouts,
  days,
  dayWidth,
  density,
  zoom,
  totalGridWidth,
  rowIndex,
  selectedEventId,
  conflictEventIds,
  isDragging,
  dragState,
  onEventClick,
  onEmptyClick,
  showPrices,
  pricingMap,
  effectiveRowHeight,
}) => {
  const theme = useTheme();
  const config = ROW_CONFIG[density];
  const isDark = theme.palette.mode === 'dark';
  const priceLineHeight = PRICE_LINE_HEIGHT[density];
  const propertyPricing = showPrices ? pricingMap.get(property.id) : undefined;

  const handleRowClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    // Calculate which day was clicked
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dayIndex = Math.floor(x / dayWidth);

    if (dayIndex >= 0 && dayIndex < days.length) {
      const clickedDate = days[dayIndex];
      const endDate = new Date(clickedDate);
      endDate.setDate(endDate.getDate() + 3); // Default 3-night stay

      onEmptyClick({
        propertyId: property.id,
        propertyName: property.name,
        startDate: toDateStr(clickedDate),
        endDate: toDateStr(endDate),
      });
    }
  }, [dayWidth, days, isDragging, onEmptyClick, property.id, property.name]);

  return (
    <Box
      sx={{
        position: 'relative',
        height: effectiveRowHeight,
        width: totalGridWidth,
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: rowIndex % 2 === 0
          ? 'transparent'
          : isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
      }}
    >
      {/* Day column backgrounds (weekends + today) */}
      {days.map((day, idx) => {
        const weekend = isWeekend(day);
        const today = isToday(day);
        if (!weekend && !today) return null;
        return (
          <Box
            key={idx}
            sx={{
              position: 'absolute',
              left: idx * dayWidth,
              top: 0,
              width: dayWidth,
              height: effectiveRowHeight,
              backgroundColor: today
                ? isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.03)'
                : weekend
                  ? isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
                  : 'transparent',
              borderRight: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* Clickable area for creating reservations */}
      <Box
        onClick={handleRowClick}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: totalGridWidth,
          height: config.rowHeight,
          cursor: 'cell',
          zIndex: 1,
        }}
      />

      {/* Event bars */}
      {barLayouts.map((layout) => {
        // Check if this bar is being resized → pass live width
        const isBeingResized =
          dragState.activeType === 'resize' &&
          dragState.activeId === `resize-${layout.event.id}` &&
          dragState.ghostLayout;
        const resizeWidth = isBeingResized ? dragState.ghostLayout!.width : null;
        const resizeConflict = isBeingResized ? dragState.dragConflict : false;

        return (
          <PlanningBar
            key={layout.event.id}
            layout={layout}
            zoom={zoom}
            isSelected={layout.event.id === selectedEventId}
            isConflict={conflictEventIds.has(layout.event.id)}
            isDragActive={isDragging}
            resizeWidth={resizeWidth}
            resizeConflict={resizeConflict}
            onClick={onEventClick}
          />
        );
      })}

      {/* Price line — below reservation/intervention bars */}
      {showPrices && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: config.rowHeight,
            width: totalGridWidth,
            height: priceLineHeight,
            display: 'flex',
            pointerEvents: 'none',
            borderTop: '1px dashed',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            backgroundColor: isDark ? 'rgba(76, 175, 80, 0.03)' : 'rgba(76, 175, 80, 0.02)',
          }}
        >
          {days.map((day, idx) => {
            const dateStr = toDateStr(day);
            const pricing = propertyPricing?.get(dateStr);
            const price = pricing?.nightlyPrice;
            // At month zoom, cells are too narrow (38px) — hide text
            const tooNarrow = dayWidth < 40;

            return (
              <Box
                key={idx}
                sx={{
                  width: dayWidth,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  borderRight: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                }}
              >
                {!tooNarrow && (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: dayWidth < 60 ? '0.5rem' : '0.5625rem',
                      fontWeight: price != null ? 600 : 400,
                      color: price != null
                        ? isDark ? 'rgba(76, 175, 80, 0.85)' : 'rgba(46, 125, 50, 0.8)'
                        : 'text.disabled',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {price != null ? formatPrice(price) : '\u2014'}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
});

PlanningRow.displayName = 'PlanningRow';
export default PlanningRow;
