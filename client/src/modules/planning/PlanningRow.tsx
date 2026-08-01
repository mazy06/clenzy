import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import PlanningBar from './PlanningBar';
import PlanningBlockedBand from './PlanningBlockedBand';
import type { BarLayout, PlanningEvent, PlanningProperty, DensityMode, ZoomLevel, QuickCreateData, RowDragState } from './types';
import { ROW_CONFIG, BAR_BORDER_RADIUS, WEEKEND_CELL_BG } from './constants';
import { isWeekend, isToday, toDateStr, getHourOffsetPx } from './utils/dateUtils';
import { resolveAttachedReservationId, type AttachmentCandidate } from './utils/interventionAttachment';
import type { PricingMap } from './hooks/usePlanningPricing';
import type { MinNightsMap } from './hooks/usePlanningMinNights';
import { cn } from '../../utils/cn';
import { Money } from '../../components/Money';
import { NightsStay } from '../../icons';

// ─── Price formatter ────────────────────────────────────────────────────────

function formatPrice(price: number, symbol: string): string {
  if (Number.isInteger(price)) return `${price}${symbol}`;
  return `${price.toFixed(1)}${symbol}`;
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
  /** Drag concernant CETTE ligne uniquement (resize en cours sur un de ses
   *  events), `null` sinon — cf. découpage dans PlanningTimeline. Passer le
   *  dragState global cassait le memo de TOUTES les lignes à chaque mousemove. */
  rowDrag: RowDragState | null;
  onEventClick: (event: PlanningEvent) => void;
  onHideEvent?: (event: PlanningEvent) => void;
  onEmptyClick: (data: QuickCreateData) => void;
  quickCreateOpen: boolean;
  showPrices: boolean;
  /** Conservé pour le contrat avec PlanningTimeline — le filtre des events
   *  est fait en amont (usePlanningFilters), la hauteur de ligne est fixe. */
  showInterventions?: boolean;
  pricingMap: PricingMap;
  minNightsMap?: MinNightsMap;
  effectiveRowHeight: number;
  /** All events (unfiltered) for conflict detection on range selection */
  allEvents: PlanningEvent[];
  /** TOUTES les réservations chargées (avant filtres/légende/plage).
   *  Sert au rattachement intervention → réservation (lien explicite OU
   *  heuristique date/propriété) : une intervention rattachée à une
   *  réservation connue n'est JAMAIS rendue en pastille isolée — même si la
   *  brique hôte est masquée ou hors plage. */
  loadedReservations: AttachmentCandidate[];
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
  rowDrag,
  onEventClick,
  onHideEvent,
  onEmptyClick,
  quickCreateOpen,
  showPrices,
  pricingMap,
  minNightsMap,
  effectiveRowHeight,
  allEvents,
  loadedReservations,
}) => {
  const config = ROW_CONFIG[density];

  // ── Interventions rattachées à une réservation (maquette) ────────────────
  // RÈGLE UNIQUE : une intervention RATTACHÉE (lien explicite
  // linkedReservationId, heuristique même propriété + date planifiée dans
  // [checkIn, checkOut] inclusif, OU fenêtre de vacance post-checkout
  // (ménage à checkout+N avant le check-in suivant) — cf.
  // resolveAttachedReservationId) est
  // UNIQUEMENT rendue comme pastille DANS la brique de sa réservation
  // (pastille blanche 20px — sur brique étroite elle compte dans le « +N »).
  // Si la brique hôte n'est pas rendue (masquée par les filtres/légende, hors
  // plage), l'intervention n'est PAS rendue du tout — jamais en pastille
  // isolée. Seules les interventions véritablement orphelines (aucune
  // réservation candidate dans les données chargées) restent sur la grille,
  // rendues en pastille icône seule par PlanningBar. Chaque layout suit UN
  // seul chemin (absorbé, ignoré ou standalone) : une intervention ne peut
  // pas être rendue 2 fois.
  const { visibleLayouts, linkedInterventionsByBarId, blockedLayouts } = useMemo(() => {
    const reservationLayoutsById = new Map<number, BarLayout>();
    for (const l of barLayouts) {
      if (l.event.type === 'reservation' && l.event.reservation) {
        reservationLayoutsById.set(l.event.reservation.id, l);
      }
    }
    const linked = new Map<string, PlanningEvent[]>();
    const visible: BarLayout[] = [];
    const blocked: BarLayout[] = [];
    for (const l of barLayouts) {
      const event = l.event;
      // Plage bloquée : rendue en bande de cellules grisées (PlanningBlockedBand),
      // jamais en brique d'événement — un blocage n'est pas un séjour.
      if (event.type === 'blocked') {
        blocked.push(l);
        continue;
      }
      // Un ménage/maintenance rattachable provient soit d'une INTERVENTION
      // (linkedReservationId), soit d'une SERVICE REQUEST « A payer »
      // (reservationId) — les deux doivent s'afficher DANS la brique de leur
      // réservation.
      const isInterventionType = event.type === 'cleaning' || event.type === 'maintenance';
      const attachable = event.intervention || event.serviceRequest;
      if (isInterventionType && attachable) {
        const linkedReservationId = event.intervention?.linkedReservationId
          ?? event.serviceRequest?.reservationId;
        const attachedResId = resolveAttachedReservationId(
          {
            propertyId: event.propertyId,
            startDate: event.startDate,
            linkedReservationId,
          },
          loadedReservations,
        );
        if (attachedResId != null) {
          const host = reservationLayoutsById.get(attachedResId);
          if (host) {
            const arr = linked.get(host.event.id);
            if (arr) {
              arr.push(event);
            } else {
              linked.set(host.event.id, [event]);
            }
          }
          // Rattachée mais brique hôte non rendue : on ne rend rien.
          continue;
        }
      }
      visible.push(l);
    }
    return { visibleLayouts: visible, linkedInterventionsByBarId: linked, blockedLayouts: blocked };
  }, [barLayouts, loadedReservations]);
  const propertyPricing = showPrices ? pricingMap.get(property.id) : undefined;
  const propertyMinNights = showPrices ? minNightsMap?.get(property.id) : undefined;
  // Hauteur active = rangée entière : les interventions partagent la bande
  // verticale de la brique (plus de couloir dédié sous la brique).
  const activeRowHeight = config.rowHeight;

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
  const dayWidthRef = useRef(dayWidth);
  const onEmptyClickRef = useRef(onEmptyClick);
  const propertyRef = useRef(property);
  const pricingMapRef = useRef(pricingMap);
  const allEventsRef = useRef(allEvents);
  useEffect(() => {
    daysRef.current = days;
    dayWidthRef.current = dayWidth;
    onEmptyClickRef.current = onEmptyClick;
    propertyRef.current = property;
    pricingMapRef.current = pricingMap;
    allEventsRef.current = allEvents;
  }, [days, dayWidth, onEmptyClick, property, pricingMap, allEvents]);

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

    // Skip if the user clicked on a planning bar — let @dnd-kit handle drag.
    // Skip aussi les plages bloquées : le clic ouvre leur tooltip, pas une sélection.
    const target = e.target as HTMLElement;
    if (target.closest('[data-planning-bar]') || target.closest('[data-blocked-range]')) return;

    const rect = e.currentTarget.getBoundingClientRect();

    // Ignore clicks outside the active grid area
    const y = e.clientY - rect.top;
    if (y > config.rowHeight) return;

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
  }, [isDragging, config]);

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
    <div className="relative bg-[transparent]" style={{ height: effectiveRowHeight, width: totalGridWidth, borderBottom: '1px solid var(--line)' }} onMouseDown={handleMouseDown}>
      {/* Day column backgrounds (weekends + today) */}
      {days.map((day, idx) => {
        const weekend = isWeekend(day);
        const today = isToday(day);
        if (!weekend && !today) return null;
        return (
          <div className="absolute top-0 pointer-events-none" style={{ left: idx * dayWidth, width: dayWidth, height: effectiveRowHeight, backgroundColor: today
                ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
                : weekend
                  ? WEEKEND_CELL_BG
                  : 'transparent' }} key={day.getTime()} />
        );
      })}

      {/* Hairlines verticales entre jours — couche AU-DESSUS des fonds
          week-end/today (posés juste avant) pour que les séparateurs restent
          visibles sur les colonnes teintées. Clip 1px avant le bord droit
          (dernier jour sans séparateur). pointer-events:none → n'intercepte
          pas les clics ; sous les briques (rendues après dans le DOM). */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${dayWidth - 1}px, var(--line) ${dayWidth - 1}px ${dayWidth}px)`,
          backgroundSize: `${totalGridWidth - 1}px 100%`,
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Cursor zone for empty areas (pointer-events off — parent handles mouseDown) */}
      <div
        className="absolute left-0 top-0 cursor-cell z-[1] pointer-events-none"
        style={{ width: totalGridWidth, height: activeRowHeight }}
      />

      {/* Selection highlight overlay (drag-to-select) — styled like reservation bars */}
      {selectionRange && (() => {
        const isError = selectionError || selectionBlocked;
        const selColor = isError ? 'var(--err)' : 'var(--ok)'; // Rouge si bloqué, vert sinon
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
              backgroundColor: `color-mix(in srgb, ${selColor} 25%, transparent)`,
              border: `1.5px solid color-mix(in srgb, ${selColor} 60%, transparent)`,
              borderRadius: `${BAR_BORDER_RADIUS}px`,
              zIndex: 4,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              px: 1,
              boxShadow: `0 2px 8px color-mix(in srgb, ${selColor} 25%, transparent)`,
              transition: isError ? 'opacity 0.3s ease' : undefined,
              animation: isError ? 'pulseError 0.4s ease-in-out 2' : undefined,
              '@keyframes pulseError': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', transition: 'none' },
            }}
          >
            {/* `selColor` est calcule au rendu : une classe Tailwind ne pouvant
                pas naitre d'une variable, la couleur passe en style inline. */}
            <p
              className="cn-text-body1 text-[0.6875rem] font-semibold truncate leading-[1.2]"
              style={{ color: selColor }}
            >
              {isError ? 'Pas de place' : `${nightCount}${nightCount === 1 ? ' nuit' : ' nuits'}`}
            </p>
          </Box>
        );
      })()}

      {/* Plages bloquées : cellules grisées + tooltip au clic (pas de brique) */}
      {blockedLayouts.map((layout) => (
        <PlanningBlockedBand
          key={layout.event.id}
          left={layout.left}
          width={layout.width}
          height={activeRowHeight}
          notes={layout.event.label && layout.event.label !== 'Bloqué' ? layout.event.label : undefined}
          source={layout.event.sublabel}
        />
      ))}

      {/* Event bars */}
      {visibleLayouts.map((layout) => {
        // Check if this bar is being resized → pass live width.
        // rowDrag n'est non-null que si le resize concerne cette ligne
        // (activeType/ghostLayout déjà vérifiés côté PlanningTimeline).
        const isBeingResized = rowDrag !== null && rowDrag.activeId === `resize-${layout.event.id}`;
        const resizeWidth = isBeingResized ? rowDrag!.ghostWidth : null;
        const resizeConflict = isBeingResized ? rowDrag!.conflict : false;

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
            onHide={onHideEvent}
            linkedInterventions={linkedInterventionsByBarId.get(layout.event.id)}
            currency={property.currency ?? 'EUR'}
          />
        );
      })}

      {/* Prix + min-nights par cellule — centres dans chaque case de jour.
          Toujours rendus, masques visuellement par les bars (z-index inferieur).
          Sur cellule libre : prix au centre, badge min-nights en bas-droite. */}
      {showPrices && days.map((day, idx) => {
        const dateStr = toDateStr(day);
        const pricing = propertyPricing?.get(dateStr);
        const price = pricing?.nightlyPrice;
        const minNights = propertyMinNights?.get(dateStr);
        if (price == null && minNights == null) return null;
        if (dayWidth < 30) return null;

        return (
          <div className="absolute top-0 flex items-center justify-center pointer-events-none z-[0] px-[1.5px] overflow-hidden" style={{ left: idx * dayWidth, width: dayWidth, height: activeRowHeight }} key={`cell-info-${dateStr}`}>
            {price != null && (
              <span
                className={cn(
                  'font-[family-name:var(--font-display)] font-medium text-[var(--muted)] opacity-80 leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full tabular-nums',
                  dayWidth < 60 ? 'text-[0.625rem]' : 'text-[0.6875rem]',
                )}
              >
                <Money value={price} from={property.currency ?? 'EUR'} compact symbolSize={dayWidth < 60 ? 9 : 10} />
              </span>
            )}
            {minNights != null && dayWidth >= 38 && (
              <div className="absolute bottom-[2px] end-[3px] flex items-center gap-0 text-[var(--faint)] opacity-85">
                <NightsStay size={8} strokeWidth={1.75} />
                <span className="text-[0.5rem] font-semibold leading-[1] tabular-nums">
                  {minNights}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

PlanningRow.displayName = 'PlanningRow';
export default PlanningRow;
