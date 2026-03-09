import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook that dynamically computes how many table rows fit in the available
 * viewport height, so that the list never needs to scroll — pagination
 * handles the overflow instead.
 *
 * The calculation is:
 *   availableHeight = window.innerHeight - offsetTop(tableContainer) - bottomChrome
 *   rowsPerPage     = floor((availableHeight - headerRowHeight) / bodyRowHeight)
 *
 * The value is clamped to [min, max] and recalculated on window resize.
 */

interface UseDynamicPageSizeOptions {
  /** Approximate height of one table body row in px (default: 49) */
  rowHeight?: number;
  /** Height of the table header row in px (default: 42) */
  headerHeight?: number;
  /** Extra pixels to subtract for pagination bar, bottom padding, etc. (default: 72) */
  bottomChrome?: number;
  /** Minimum rows to show (default: 5) */
  min?: number;
  /** Maximum rows to show (default: 50) */
  max?: number;
  /** Fallback if measurement is not yet available (default: 10) */
  fallback?: number;
}

export function useDynamicPageSize(options: UseDynamicPageSizeOptions = {}) {
  const {
    rowHeight = 49,
    headerHeight = 42,
    bottomChrome = 72,
    min = 5,
    max = 50,
    fallback = 10,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(fallback);

  const compute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const available = window.innerHeight - rect.top - bottomChrome;
    const rows = Math.floor((available - headerHeight) / rowHeight);
    const clamped = Math.max(min, Math.min(max, rows));

    setPageSize((prev) => (prev !== clamped ? clamped : prev));
  }, [rowHeight, headerHeight, bottomChrome, min, max]);

  // Compute on mount + resize
  useEffect(() => {
    // Initial computation after a small delay to let the layout settle
    const timer = setTimeout(compute, 50);

    const handleResize = () => {
      compute();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [compute]);

  return { containerRef, pageSize };
}
