import { useState, useCallback, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import type { ZoomLevel } from '../types';
import { ZOOM_CONFIGS, BUFFER_MULTIPLIER, EXTEND_THRESHOLD_DAYS } from '../constants';
import { generateDays, computeBufferRange, addDays, subDays } from '../utils/dateUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseInfiniteTimelineConfig {
  anchorDate: Date;
  zoom: ZoomLevel;
  dayWidth: number;
  propertyColWidth: number;
}

export interface UseInfiniteTimelineReturn {
  days: Date[];
  totalGridWidth: number;
  bufferStart: Date;
  bufferEnd: Date;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  scrollToDate: (date: Date) => void;
  scrollToAnchor: () => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useInfiniteTimeline({
  anchorDate,
  zoom,
  dayWidth,
  propertyColWidth,
}: UseInfiniteTimelineConfig): UseInfiniteTimelineReturn {
  const config = ZOOM_CONFIGS[zoom];
  const extendAmount = config.visibleDays; // how many days to add when extending

  // Buffer state
  const [bufferStart, setBufferStart] = useState(() => {
    const range = computeBufferRange(anchorDate, zoom, BUFFER_MULTIPLIER);
    return range.start;
  });
  const [bufferEnd, setBufferEnd] = useState(() => {
    const range = computeBufferRange(anchorDate, zoom, BUFFER_MULTIPLIER);
    return range.end;
  });

  // Generate days from buffer
  const days = useMemo(() => generateDays(bufferStart, bufferEnd), [bufferStart, bufferEnd]);
  const totalGridWidth = days.length * dayWidth;

  // Refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingCompensation = useRef(0);
  const isExtending = useRef(false);
  const prevDaysLength = useRef(days.length);

  // ── Scroll compensation after prepend (runs before paint) ─────────────────

  useLayoutEffect(() => {
    if (scrollRef.current && pendingCompensation.current !== 0) {
      scrollRef.current.scrollLeft += pendingCompensation.current;
      pendingCompensation.current = 0;
    }
    prevDaysLength.current = days.length;
  }, [days.length]);

  // ── Recenter buffer when anchor or zoom changes ───────────────────────────

  // Track previous anchor+zoom to detect external navigation
  const prevAnchorRef = useRef(anchorDate);
  const prevZoomRef = useRef(zoom);

  useLayoutEffect(() => {
    const anchorChanged =
      anchorDate.getFullYear() !== prevAnchorRef.current.getFullYear() ||
      anchorDate.getMonth() !== prevAnchorRef.current.getMonth() ||
      anchorDate.getDate() !== prevAnchorRef.current.getDate();
    const zoomChanged = zoom !== prevZoomRef.current;

    if (anchorChanged || zoomChanged) {
      const range = computeBufferRange(anchorDate, zoom, BUFFER_MULTIPLIER);
      setBufferStart(range.start);
      setBufferEnd(range.end);
      prevAnchorRef.current = anchorDate;
      prevZoomRef.current = zoom;

      // Schedule scroll to anchor after DOM update
      requestAnimationFrame(() => {
        scrollToDateImmediate(anchorDate);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, zoom]);

  // ── Mouse wheel → horizontal scroll ─────────────────────────────────────

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Convert vertical wheel to horizontal scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  });

  // ── Scroll monitoring ─────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isExtending.current) return;

    const scrollLeft = el.scrollLeft;
    const contentScrollLeft = Math.max(0, scrollLeft);
    const containerWidth = el.clientWidth - propertyColWidth;

    const visibleStartIndex = Math.floor(contentScrollLeft / dayWidth);
    const visibleEndIndex = visibleStartIndex + Math.ceil(containerWidth / dayWidth);

    // Extend left
    if (visibleStartIndex < EXTEND_THRESHOLD_DAYS) {
      isExtending.current = true;
      pendingCompensation.current = extendAmount * dayWidth;
      setBufferStart((prev) => subDays(prev, extendAmount));
      requestAnimationFrame(() => {
        isExtending.current = false;
      });
    }

    // Extend right
    if (days.length - visibleEndIndex < EXTEND_THRESHOLD_DAYS) {
      isExtending.current = true;
      setBufferEnd((prev) => addDays(prev, extendAmount));
      requestAnimationFrame(() => {
        isExtending.current = false;
      });
    }
  }, [dayWidth, days.length, extendAmount, propertyColWidth]);

  // ── Scroll to specific date ───────────────────────────────────────────────

  const scrollToDateImmediate = useCallback(
    (targetDate: Date) => {
      const el = scrollRef.current;
      if (!el) return;

      // Find target index in current days
      const targetIndex = days.findIndex(
        (d) =>
          d.getFullYear() === targetDate.getFullYear() &&
          d.getMonth() === targetDate.getMonth() &&
          d.getDate() === targetDate.getDate(),
      );

      if (targetIndex >= 0) {
        const containerWidth = el.clientWidth - propertyColWidth;
        // Position the target date ~1/3 from the left for context
        const targetScrollLeft = Math.max(0, targetIndex * dayWidth - containerWidth / 3);
        el.scrollLeft = targetScrollLeft;
      }
    },
    [days, dayWidth, propertyColWidth],
  );

  const scrollToDate = useCallback(
    (targetDate: Date) => {
      const el = scrollRef.current;
      if (!el) return;

      const targetIndex = days.findIndex(
        (d) =>
          d.getFullYear() === targetDate.getFullYear() &&
          d.getMonth() === targetDate.getMonth() &&
          d.getDate() === targetDate.getDate(),
      );

      if (targetIndex >= 0) {
        const containerWidth = el.clientWidth - propertyColWidth;
        const targetScrollLeft = Math.max(0, targetIndex * dayWidth - containerWidth / 3);
        el.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
      }
      // If not in buffer, the anchorDate change will trigger buffer recenter
    },
    [days, dayWidth, propertyColWidth],
  );

  const scrollToAnchor = useCallback(() => {
    requestAnimationFrame(() => {
      scrollToDateImmediate(anchorDate);
    });
  }, [anchorDate, scrollToDateImmediate]);

  return {
    days,
    totalGridWidth,
    bufferStart,
    bufferEnd,
    scrollRef,
    handleScroll,
    scrollToDate,
    scrollToAnchor,
  };
}
