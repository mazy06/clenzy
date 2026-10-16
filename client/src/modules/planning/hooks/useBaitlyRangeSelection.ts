import React, { useRef, useState, useEffect } from 'react';
import type { PlanningEvent, PlanningProperty, QuickCreateData } from '../types';
import type { PricingMap } from './usePlanningPricing';
import { toDateStr, getHourOffsetPx } from '../utils/dateUtils';
import { validatePlanningEvent } from '../utils/conflictUtils';
import { useNotification } from '../../../hooks/useNotification';
import { useTranslation } from 'react-i18next';
import { inlineOffsetInRect } from '../../../utils/inlineScroll';

interface BaitlyRangeSelectionOptions {
  days: Date[];
  dayWidth: number;
  property: PlanningProperty;
  pricingMap: PricingMap;
  allEvents: PlanningEvent[];
  isDragging: boolean;
  isRtl: boolean;
  rowHeight: number;
  quickCreateOpen: boolean;
  onEmptyClick: (data: QuickCreateData) => void;
}

/** Sélection de séjour Baitly : validation sur les données complètes, avant filtres. */
export function useBaitlyRangeSelection({
  days, dayWidth, property, pricingMap, allEvents, isDragging, isRtl,
  rowHeight, quickCreateOpen, onEmptyClick,
}: BaitlyRangeSelectionOptions) {
  const { notify } = useNotification();
  const { t } = useTranslation();
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();
  const [keyboardDay, setKeyboardDay] = useState(0);
  const keyboardAnchor = useRef<number | null>(null);
  const isRtlRef = useRef(isRtl);
  isRtlRef.current = isRtl;
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
  const findAdjustedStart = (rawStartIdx: number): { dayIdx: number; endTime: string } => {
    const currentDays = daysRef.current;
    const prop = propertyRef.current;
    const currentAllEvents = allEventsRef.current;
    const defaultCheckIn = prop.defaultCheckInTime || '15:00';

    const toTs = (d: string, t?: string) => t ? `${d} ${t}` : d;
    const samePropertyEvents = currentAllEvents.filter((e) => e.propertyId === prop.id && e.status !== 'cancelled');

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

  const finishSelection = () => {
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
      const { dayIdx: adjustedDayIdx, endTime: latestEndTime } = findAdjustedStart(rawStartIdx);

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
        notify.warning(t('planning.noRoom'));
        errorTimer.current = setTimeout(() => {
          setSelectionError(false);
          setSelectionRange(null);
        }, 1500);
        selectionRef.current = null;
        return;
      }

      const validation = validatePlanningEvent({
        id: 'new-reservation', propertyId: prop.id, type: 'reservation',
        startDate: adjustedStartStr, endDate: rawEndStr,
        startTime: adjustedCheckInTime, endTime: defaultCheckOut,
        label: '', status: 'confirmed', color: '',
      }, currentAllEvents);
      if (!validation.valid) {
        notify.warning(t(`planning.feedback.${validation.reason}`, validation.error ?? 'Ce créneau est indisponible.'));
        setSelectionRange(null);
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

  useEffect(() => {
    setKeyboardDay(0);
    keyboardAnchor.current = null;
    setSelectionRange(null);
    cleanupListeners.current?.();
    cleanupListeners.current = null;
    selectionRef.current = null;
  }, [days]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging || quickCreateOpen || e.isPrimary === false || (e.pointerType !== 'touch' && e.button !== 0)) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-planning-bar], [data-blocked-range], button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientY - rect.top > rowHeight) return;
    const index = Math.floor(inlineOffsetInRect(e.clientX, rect, isRtlRef.current) / dayWidthRef.current);
    if (index < 0 || index >= daysRef.current.length) return;
    cleanupListeners.current?.();
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setSelectionError(false);
    setSelectionBlocked(false);
    selectionRef.current = { startIndex: index, endIndex: index, isSelecting: false, startX: e.clientX, rect };
    // Au doigt, le glissement reste le défilement natif. Un tap ouvre les dates modifiables.
    if (e.pointerType !== 'touch') e.preventDefault();
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId || !selectionRef.current) return;
      if (e.pointerType === 'touch') {
        if (Math.abs(ev.clientX - e.clientX) > 8 || Math.abs(ev.clientY - e.clientY) > 8) cancel();
        return;
      }
      const sel = selectionRef.current;
      if (Math.abs(ev.clientX - sel.startX) <= 5 && !sel.isSelecting) return;
      sel.isSelecting = true;
      sel.endIndex = Math.max(0, Math.min(daysRef.current.length - 1,
        Math.floor(inlineOffsetInRect(ev.clientX, rect, isRtlRef.current) / dayWidthRef.current)));
      const rawStart = Math.min(sel.startIndex, sel.endIndex);
      const rawEnd = Math.max(sel.startIndex, sel.endIndex);
      const { dayIdx, endTime } = findAdjustedStart(rawStart);
      setSelectionBlocked(dayIdx > rawEnd);
      setSelectionRange({ start: dayIdx > rawEnd ? rawStart : dayIdx, end: rawEnd,
        startOffsetPx: endTime ? getHourOffsetPx(endTime, dayWidthRef.current) : 0 });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      cleanupListeners.current?.();
      cleanupListeners.current = null;
      finishSelection();
    };
    const cancel = () => {
      cleanupListeners.current?.();
      cleanupListeners.current = null;
      selectionRef.current = null;
      setSelectionRange(null);
    };
    const cancelled = (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) cancel(); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancelled);
    cleanupListeners.current = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancelled);
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || isDragging || quickCreateOpen) return;
    if (e.key === 'Escape') {
      keyboardAnchor.current = null;
      setSelectionRange(null);
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const delta = (e.key === 'ArrowRight' ? 1 : -1) * (isRtlRef.current ? -1 : 1);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? days.length - 1
        : Math.max(0, Math.min(days.length - 1, keyboardDay + delta));
      if (e.shiftKey && keyboardAnchor.current == null) keyboardAnchor.current = keyboardDay;
      if (!e.shiftKey) keyboardAnchor.current = null;
      setKeyboardDay(next);
      setSelectionRange({ start: Math.min(keyboardAnchor.current ?? next, next),
        end: Math.max(keyboardAnchor.current ?? next, next), startOffsetPx: 0 });

    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectionRef.current = { startIndex: keyboardAnchor.current ?? keyboardDay, endIndex: keyboardDay,
        isSelecting: keyboardAnchor.current != null, startX: 0, rect: e.currentTarget.getBoundingClientRect() };
      finishSelection();
      keyboardAnchor.current = null;
    }
  };

  // Cleanup document listeners on unmount
  useEffect(() => {
    return () => {
      cleanupListeners.current?.();
      if (errorTimer.current) clearTimeout(errorTimer.current);
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

  return { selectionRange, selectionError, selectionBlocked, handlePointerDown, handleKeyDown, keyboardDay };
}
