import React, { useMemo } from 'react';
import { Box, Paper } from '@mui/material';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import PlanningDateHeaders from './PlanningDateHeaders';
import PlanningPropertyColumn from './PlanningPropertyColumn';
import PlanningRow from './PlanningRow';
import PlanningTodayLine from './PlanningTodayLine';
import PlanningBarGhost from './PlanningBarGhost';
import type { PlanningProperty, PlanningEvent, BarLayout, DensityMode, ZoomLevel, QuickCreateData, UrgencyAnimationMode } from './types';
import type { UsePlanningDragReturn } from './hooks/usePlanningDrag';
import type { PricingMap } from './hooks/usePlanningPricing';
import type { MinNightsMap } from './hooks/usePlanningMinNights';
import type { ChannelSyncMap } from './hooks/usePlanningChannelSync';
import { ROW_CONFIG } from './constants';
import { detectConflicts } from './utils/conflictUtils';
import { toDateStr } from './utils/dateUtils';

interface PlanningTimelineProps {
  properties: PlanningProperty[];
  days: Date[];
  dayWidth: number;
  density: DensityMode;
  zoom: ZoomLevel;
  getBarLayouts: (propertyId: number) => BarLayout[];
  totalGridWidth: number;
  selectedEventId: string | null;
  events: PlanningEvent[];
  drag: UsePlanningDragReturn;
  onEventClick: (event: PlanningEvent) => void;
  onHideEvent?: (event: PlanningEvent) => void;
  onEmptyClick: (data: QuickCreateData) => void;
  quickCreateOpen: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  propertyColWidth: number;
  onPropertyColWidthChange?: (width: number) => void;
  showPrices: boolean;
  showInterventions: boolean;
  pricingMap: PricingMap;
  minNightsMap?: MinNightsMap;
  channelSyncMap?: ChannelSyncMap;
  pageSize?: number;
  onPropertyClick?: (propertyId: number) => void;
  urgencyAnimation?: UrgencyAnimationMode;
}

const PlanningTimeline: React.FC<PlanningTimelineProps> = React.memo(({
  properties,
  days,
  dayWidth,
  density,
  zoom,
  getBarLayouts,
  totalGridWidth,
  selectedEventId,
  events,
  drag,
  onEventClick,
  onHideEvent,
  onEmptyClick,
  quickCreateOpen,
  scrollRef,
  onScroll,
  propertyColWidth,
  onPropertyColWidthChange,
  showPrices,
  showInterventions,
  pricingMap,
  minNightsMap,
  channelSyncMap,
  pageSize,
  onPropertyClick,
  urgencyAnimation,
}) => {
  const config = ROW_CONFIG[density];
  // Plus de price line dediee : les prix sont desormais affiches dans
  // chaque cellule de jour, centres et masques sous les bars.
  // When interventions are hidden, shrink the row to only reservation bar + padding
  const baseRowHeight = showInterventions
    ? config.rowHeight
    : config.interventionTop + 2; // reservation bar area + small bottom padding
  const effectiveRowHeight = baseRowHeight;
  // Fill remaining space with empty rows
  const emptyRowCount = pageSize ? Math.max(0, pageSize - properties.length) : 0;
  const totalDisplayRows = properties.length + emptyRowCount;
  const totalRowsHeight = totalDisplayRows * effectiveRowHeight;
  // Hauteur du today line : limitee aux lignes "vraies" (sans les empty
  // fillers de pagination). Le trait rouge s'arrete au bas du dernier logement.
  const todayLineHeight = properties.length * effectiveRowHeight;

  // Detect conflicts
  const conflictEventIds = useMemo(() => {
    const conflicts = detectConflicts(events);
    const ids = new Set<string>();
    for (const c of conflicts) {
      ids.add(c.eventA.id);
      ids.add(c.eventB.id);
    }
    return ids;
  }, [events]);

  // Count UPCOMING reservations per property (for the small tag indicator
  // in the property column). Filtre les reservations passees (endDate < aujourd'hui)
  // et les interventions — seules les reservations en cours ou a venir.
  const reservationCountByProperty = useMemo(() => {
    const todayStr = toDateStr(new Date());
    const map = new Map<number, number>();
    for (const evt of events) {
      if (evt.type !== 'reservation') continue;
      if (evt.endDate < todayStr) continue;
      map.set(evt.propertyId, (map.get(evt.propertyId) ?? 0) + 1);
    }
    return map;
  }, [events]);

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        // Carte Signature : hairline + radius lg (maquette .pl-grid)
        backgroundColor: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <DndContext
        sensors={drag.sensors}
        modifiers={drag.modifiers}
        onDragStart={drag.handleDragStart}
        onDragMove={drag.handleDragMove}
        onDragEnd={drag.handleDragEnd}
        onDragCancel={drag.handleDragCancel}
      >
        <Box
          ref={scrollRef}
          onScroll={onScroll}
          sx={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            position: 'relative',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',           // Firefox
            '&::-webkit-scrollbar': { display: 'none' },  // Chrome/Safari
          }}
        >
          {/* Scrollable content: headers + rows */}
          <Box sx={{ width: propertyColWidth + totalGridWidth, minWidth: '100%' }}>
            {/* Date headers (sticky top) */}
            <PlanningDateHeaders
              days={days}
              dayWidth={dayWidth}
              zoom={zoom}
              totalGridWidth={totalGridWidth}
              propertyColWidth={propertyColWidth}
              propertyCount={properties.length}
            />

            {/* Body: property column + grid rows */}
            <Box sx={{ display: 'flex', position: 'relative' }}>
              {/* Property column (sticky left) */}
              <PlanningPropertyColumn
                properties={properties}
                density={density}
                selectedPropertyId={null}
                colWidth={propertyColWidth}
                onColWidthChange={onPropertyColWidthChange}
                effectiveRowHeight={effectiveRowHeight}
                emptyRowCount={emptyRowCount}
                onPropertyClick={onPropertyClick}
                reservationCountByProperty={reservationCountByProperty}
                channelSyncMap={channelSyncMap}
              />

              {/* Grid rows */}
              <Box sx={{ position: 'relative', width: totalGridWidth, flexShrink: 0 }}>
                {/* Today line spanning all rows */}
                <PlanningTodayLine
                  days={days}
                  dayWidth={dayWidth}
                  totalHeight={todayLineHeight}
                />

                {/* Property rows */}
                {properties.map((property, idx) => (
                  <PlanningRow
                    key={property.id}
                    property={property}
                    barLayouts={getBarLayouts(property.id)}
                    days={days}
                    dayWidth={dayWidth}
                    density={density}
                    zoom={zoom}
                    totalGridWidth={totalGridWidth}
                    rowIndex={idx}
                    selectedEventId={selectedEventId}
                    conflictEventIds={conflictEventIds}
                    isDragging={drag.state.isDragging}
                    dragState={drag.state}
                    onEventClick={onEventClick}
                    onHideEvent={onHideEvent}
                    onEmptyClick={onEmptyClick}
                    quickCreateOpen={quickCreateOpen}
                    showPrices={showPrices}
                    showInterventions={showInterventions}
                    pricingMap={pricingMap}
                    minNightsMap={minNightsMap}
                    effectiveRowHeight={effectiveRowHeight}
                    allEvents={events}
                    urgencyAnimation={urgencyAnimation}
                  />
                ))}

                {/* Empty filler rows to fill remaining space */}
                {Array.from({ length: emptyRowCount }, (_, i) => (
                  <Box
                    key={`empty-grid-${i}`}
                    sx={{
                      height: effectiveRowHeight,
                      width: totalGridWidth,
                      backgroundColor: (properties.length + i) % 2 === 0
                        ? 'transparent'
                        : 'color-mix(in srgb, var(--ink) 1.5%, transparent)',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Drag ghost overlay — only for move, resize uses live width on the bar */}
        <DragOverlay dropAnimation={null}>
          {drag.state.activeType === 'move' && drag.state.ghostLayout && (
            <PlanningBarGhost
              layout={drag.state.ghostLayout}
              isConflict={drag.state.dragConflict}
            />
          )}
        </DragOverlay>
      </DndContext>
    </Paper>
  );
});

PlanningTimeline.displayName = 'PlanningTimeline';
export default PlanningTimeline;
