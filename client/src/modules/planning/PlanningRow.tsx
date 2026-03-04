import React, { useCallback, useRef, useState, useEffect } from 'react';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import PlanningBar from './PlanningBar';
import type { BarLayout, PlanningEvent, PlanningProperty, DensityMode, ZoomLevel, QuickCreateData, PlanningDragState } from './types';
import { ROW_CONFIG, PRICE_LINE_HEIGHT, BAR_BORDER_RADIUS } from './constants';
import { isWeekend, isToday, toDateStr, getHourOffsetPx } from './utils/dateUtils';
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
  quickCreateOpen: boolean;
  showPrices: boolean;
  showInterventions: boolean;
  pricingMap: PricingMap;
  effectiveRowHeight: number;
  /** All events (unfiltered) for conflict detection on range selection */
  allEvents: PlanningEvent[];
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
  quickCreateOpen,
  showPrices,
  showInterventions,
  pricingMap,
  effectiveRowHeight,
  allEvents,
}) => {
  const theme = useTheme();
  const config = ROW_CONFIG[density];
  const isDark = theme.palette.mode === 'dark';
  const priceLineHeight = PRICE_LINE_HEIGHT[density];
  const propertyPricing = showPrices ? pricingMap.get(property.id) : undefined;
  const activeRowHeight = showInterventions ? config.rowHeight : config.interventionTop + 2;

  // ── Drag-to-select state ──────────────────────────────────────────────────
  const selectionRef = useRef<{
    startIndex: number;
    endIndex: number;
    isSelecting: boolean;
    startX: number;
    rect: DOMRect;
  } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
    /** Sub-day pixel offset for the start (aligns with checkout/intervention end hour) */
    startOffsetPx: number;
  } | null>(null);

  // Stable refs for values used in document-level listeners
  const daysRef = useRef(days);
  daysRef.current = days;
  const dayWidthRef = useRef(dayWidth);
  dayWidthRef.current = dayWidth;
  const onEmptyClickRef = useRef(onEmptyClick);
  onEmptyClickRef.current = onEmptyClick;
  const propertyRef = useRef(property);
  propertyRef.current = property;
  const pricingMapRef = useRef(pricingMap);
  pricingMapRef.current = pricingMap;
  const allEventsRef = useRef(allEvents);
  allEventsRef.current = allEvents;

  // ── Red flash / blocked state for rejected selections ────────────────────
  const [selectionError, setSelectionError] = useState(false);
  const [selectionBlocked, setSelectionBlocked] = useState(false);

  /** Resolve the nightly price for a given date: dynamic pricing first, then property base */
  const resolveNightlyPrice = (startDate: Date, propertyId: number, basePrice: number): number => {
    const dateStr = toDateStr(startDate);
    const dynamicPrice = pricingMapRef.current.get(propertyId)?.get(dateStr)?.nightlyPrice;
    return dynamicPrice ?? basePrice;
  };

  /**
   * Find the adjusted start after overlapping events on the same property.
   * Uses an **iterative walk** approach: starts at the raw selection start,
   * finds events that contain that point, pushes past them, then repeats
   * until a free slot is found (or there's no room).
   *
   * This avoids jumping past events at the END of the range that don't
   * block the start position (e.g. a later reservation further along).
   *
   * Returns: { dayIdx, endTime } for sub-day pixel positioning.
   * dayIdx > rawEndIdx means no room.
   */
  const findAdjustedStart = (rawStartIdx: number, rawEndIdx: number): { dayIdx: number; endTime: string } => {
    const currentDays = daysRef.current;
    const prop = propertyRef.current;
    const currentAllEvents = allEventsRef.current;
    const defaultCheckIn = prop.defaultCheckInTime || '15:00';

    const toTs = (d: string, t?: string) => t ? `${d} ${t}` : d;
    const samePropertyEvents = currentAllEvents.filter((e) => e.propertyId === prop.id);

    // Start from the beginning of the raw start day (00:00) so we detect
    // ALL events on that day (checkout, cleaning, etc.), even those ending
    // before defaultCheckIn. The dialog will enforce the proper check-in time.
    let curDate = toDateStr(currentDays[rawStartIdx]);
    let curTime = '00:00';
    let curTs = toTs(curDate, curTime);
    let adjusted = false;

    // Iteratively push past events that contain/overlap the current start point
    let moved = true;
    let iterations = 0;
    while (moved && iterations < 50) {
      moved = false;
      iterations++;
      for (const evt of samePropertyEvents) {
        // Default to 00:00 / 23:59 when times are missing so events
        // without explicit hours still block the full day range.
        const evtStartTs = toTs(evt.startDate, evt.startTime || '00:00');
        const evtEndTs = toTs(evt.endDate, evt.endTime || '23:59');

        // Does this event contain our current start point?
        // (event starts at or before our point, and ends after our point)
        if (evtStartTs <= curTs && evtEndTs > curTs) {
          curDate = evt.endDate;
          curTime = evt.endTime || '23:59';
          curTs = toTs(curDate, curTime);
          moved = true;
          adjusted = true;
        } else if (
          // Same-day intervention that STARTS AFTER our point but still
          // occupies the current day (e.g., cleaning starts 1h after checkout).
          // Only applies once we've already pushed past a reservation.
          adjusted &&
          evt.type !== 'reservation' &&
          evt.startDate === curDate &&
          evtEndTs > curTs
        ) {
          curDate = evt.endDate;
          curTime = evt.endTime || '23:59';
          curTs = toTs(curDate, curTime);
          moved = true;
        }
      }
    }

    if (!adjusted) return { dayIdx: rawStartIdx, endTime: '' }; // No overlap at start

    // Find the day index for the adjusted date
    for (let i = 0; i < currentDays.length; i++) {
      const ds = toDateStr(currentDays[i]);
      if (ds === curDate) return { dayIdx: i, endTime: curTime };
      if (ds > curDate) return { dayIdx: i, endTime: curTime };
    }

    return { dayIdx: currentDays.length, endTime: curTime }; // Past visible days → no room
  };

  const cleanupListeners = useRef<(() => void) | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    if (e.button !== 0) return; // Left button only

    // Skip if the user clicked on a planning bar — let @dnd-kit handle drag
    const target = e.target as HTMLElement;
    if (target.closest('[data-planning-bar]')) return;

    const rect = e.currentTarget.getBoundingClientRect();

    // Ignore clicks outside the active grid area (e.g. on the price line)
    const y = e.clientY - rect.top;
    const activeH = showInterventions ? config.rowHeight : config.interventionTop + 2;
    if (y > activeH) return;

    const x = e.clientX - rect.left;
    const dayIndex = Math.floor(x / dayWidthRef.current);

    if (dayIndex < 0 || dayIndex >= daysRef.current.length) return;

    // Reset previous states
    setSelectionBlocked(false);
    setSelectionError(false);

    selectionRef.current = {
      startIndex: dayIndex,
      endIndex: dayIndex,
      isSelecting: false,
      startX: e.clientX,
      rect,
    };

    e.preventDefault(); // Prevent text selection

    const handleDocMouseMove = (ev: MouseEvent) => {
      const sel = selectionRef.current;
      if (!sel) return;

      const currentX = ev.clientX - sel.rect.left;
      const currentDayIndex = Math.max(0, Math.min(
        daysRef.current.length - 1,
        Math.floor(currentX / dayWidthRef.current),
      ));

      // Activate drag mode after 5px threshold
      if (!sel.isSelecting && Math.abs(ev.clientX - sel.startX) > 5) {
        sel.isSelecting = true;
      }

      if (sel.isSelecting && currentDayIndex !== sel.endIndex) {
        sel.endIndex = currentDayIndex;
        const rawStart = Math.min(sel.startIndex, currentDayIndex);
        const rawEnd = Math.max(sel.startIndex, currentDayIndex);

        // Auto-adjust start past overlapping events (real-time during drag)
        const { dayIdx: adjustedStart, endTime } = findAdjustedStart(rawStart, rawEnd);

        if (adjustedStart > rawEnd) {
          // No room — show blocked overlay (red) over the full raw range
          setSelectionRange({ start: rawStart, end: rawEnd, startOffsetPx: 0 });
          setSelectionBlocked(true);
        } else {
          // Compute sub-day pixel offset from the event end time
          const offsetPx = endTime
            ? getHourOffsetPx(endTime, dayWidthRef.current)
            : 0;
          setSelectionRange({ start: adjustedStart, end: rawEnd, startOffsetPx: offsetPx });
          setSelectionBlocked(false);
        }
      }
    };

    const handleDocMouseUp = () => {
      // Remove document listeners
      document.removeEventListener('mousemove', handleDocMouseMove);
      document.removeEventListener('mouseup', handleDocMouseUp);
      cleanupListeners.current = null;

      // Clear live-drag blocked state
      setSelectionBlocked(false);

      const sel = selectionRef.current;
      if (!sel) return;

      const prop = propertyRef.current;
      const currentDays = daysRef.current;
      const currentAllEvents = allEventsRef.current;

      const defaultCheckIn = prop.defaultCheckInTime || '15:00';
      const defaultCheckOut = prop.defaultCheckOutTime || '11:00';

      // ── Determine raw selected range ────────────────────────────────────
      let rawStartIdx: number;
      let rawEndIdx: number;
      let rawEndStr: string;

      if (sel.isSelecting) {
        rawStartIdx = Math.min(sel.startIndex, sel.endIndex);
        rawEndIdx = Math.max(sel.startIndex, sel.endIndex);
        const endDate = new Date(currentDays[rawEndIdx]);
        endDate.setDate(endDate.getDate() + 1);
        rawEndStr = toDateStr(endDate);
      } else {
        const minNights = prop.minimumNights || 1;
        rawStartIdx = sel.startIndex;
        rawEndIdx = Math.min(sel.startIndex + minNights - 1, currentDays.length - 1);
        const clickedDate = currentDays[sel.startIndex];
        const endDate = new Date(clickedDate);
        endDate.setDate(endDate.getDate() + minNights);
        rawEndStr = toDateStr(endDate);
      }

      // ── Find overlapping events & compute adjusted start ────────────────
      const { dayIdx: adjustedDayIdx, endTime: latestEndTime } = findAdjustedStart(rawStartIdx, rawEndIdx);

      let adjustedStartStr = toDateStr(currentDays[rawStartIdx]);
      let adjustedCheckInTime = defaultCheckIn;

      if (latestEndTime && adjustedDayIdx < currentDays.length) {
        // Adjustment happened (possibly same day with time offset)
        adjustedStartStr = toDateStr(currentDays[adjustedDayIdx]);
        adjustedCheckInTime = latestEndTime > defaultCheckIn ? latestEndTime : defaultCheckIn;
      } else if (adjustedDayIdx > rawStartIdx && adjustedDayIdx < currentDays.length) {
        adjustedStartStr = toDateStr(currentDays[adjustedDayIdx]);
      }

      // No room: adjusted start is on or past the end date → flash red
      if (adjustedDayIdx > rawEndIdx || adjustedStartStr >= rawEndStr) {
        const offsetPx = latestEndTime
          ? getHourOffsetPx(latestEndTime, dayWidthRef.current)
          : 0;
        setSelectionRange({ start: rawStartIdx, end: rawEndIdx, startOffsetPx: offsetPx });
        setSelectionError(true);
        setTimeout(() => {
          setSelectionError(false);
          setSelectionRange(null);
        }, 1500);
        selectionRef.current = null;
        return;
      }

      // ── Open quick-create dialog with adjusted dates ────────────────────
      onEmptyClickRef.current({
        propertyId: prop.id,
        propertyName: prop.name,
        startDate: adjustedStartStr,
        endDate: rawEndStr,
        nightlyPrice: resolveNightlyPrice(new Date(adjustedStartStr), prop.id, prop.nightlyPrice ?? 0),
        defaultCheckInTime: adjustedCheckInTime,
        defaultCheckOutTime: defaultCheckOut,
        cleaningFrequency: prop.cleaningFrequency,
        cleaningBasePrice: prop.cleaningBasePrice,
      });

      selectionRef.current = null;
      // Don't clear selectionRange here — keep the overlay visible while dialog is open.
      // It will be cleared when quickCreateOpen goes from true → false.
    };

    document.addEventListener('mousemove', handleDocMouseMove);
    document.addEventListener('mouseup', handleDocMouseUp);
    cleanupListeners.current = () => {
      document.removeEventListener('mousemove', handleDocMouseMove);
      document.removeEventListener('mouseup', handleDocMouseUp);
    };
  }, [isDragging, showInterventions, config]);

  // Cleanup document listeners on unmount
  useEffect(() => {
    return () => {
      cleanupListeners.current?.();
    };
  }, []);

  // Clear selection overlay when quick-create dialog closes
  useEffect(() => {
    if (!quickCreateOpen && selectionRange) {
      setSelectionRange(null);
      setSelectionError(false);
      setSelectionBlocked(false);
    }
  }, [quickCreateOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      onMouseDown={handleMouseDown}
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

      {/* Cursor zone for empty areas (pointer-events off — parent handles mouseDown) */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: totalGridWidth,
          height: activeRowHeight,
          cursor: 'cell',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Selection highlight overlay (drag-to-select) — styled like reservation bars */}
      {selectionRange && (() => {
        const isError = selectionError || selectionBlocked;
        const selColor = isError ? '#EF4444' : '#26A69A'; // Red on error/blocked, teal otherwise
        const nightCount = selectionRange.end - selectionRange.start + 1;
        const offsetPx = selectionRange.startOffsetPx || 0;
        const leftPx = selectionRange.start * dayWidth + offsetPx;
        const widthPx = nightCount * dayWidth - offsetPx;
        return (
          <Box
            sx={{
              position: 'absolute',
              left: leftPx,
              top: config.barPadding,
              width: Math.max(widthPx, 4), // Minimum 4px so the bar is always visible
              height: config.reservationBarHeight,
              backgroundColor: alpha(selColor, isDark ? 0.35 : 0.25),
              border: `1.5px solid ${alpha(selColor, 0.6)}`,
              borderLeft: `3px solid ${selColor}`,
              borderRadius: `${BAR_BORDER_RADIUS}px`,
              zIndex: 4,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              px: 1,
              boxShadow: `0 2px 8px ${alpha(selColor, 0.25)}`,
              transition: isError ? 'opacity 0.3s ease' : undefined,
              animation: isError ? 'pulseError 0.4s ease-in-out 2' : undefined,
              '@keyframes pulseError': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: isDark ? (isError ? '#FCA5A5' : 'text.primary') : selColor,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
              }}
            >
              {isError ? 'Pas de place' : `${nightCount}${nightCount === 1 ? ' nuit' : ' nuits'}`}
            </Typography>
          </Box>
        );
      })()}

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
            top: activeRowHeight,
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
