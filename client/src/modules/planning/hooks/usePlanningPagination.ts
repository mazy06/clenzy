import { useState, useEffect, useMemo, useCallback } from 'react';
import type { PlanningProperty, DensityMode } from '../types';
import {
  ROW_CONFIG,
  PRICE_LINE_HEIGHT,
  DATE_HEADER_HEIGHT,
  PAGINATION_BAR_HEIGHT,
  TOOLBAR_HEIGHT,
  APP_HEADER_HEIGHT,
} from '../constants';

// ─── Types ──────────────────────────────────────────────────────────────────

interface UsePlanningPaginationConfig {
  totalProperties: PlanningProperty[];
  density: DensityMode;
  isFullscreen: boolean;
  showPrices: boolean;
}

export interface UsePlanningPaginationReturn {
  paginatedProperties: PlanningProperty[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  rangeStart: number;
  rangeEnd: number;
  goToPage: (page: number) => void;
  goNextPage: () => void;
  goPrevPage: () => void;
}

// ─── Page size computation ──────────────────────────────────────────────────

function computePageSize(
  viewportHeight: number,
  density: DensityMode,
  isFullscreen: boolean,
  showPrices: boolean,
): number {
  const rowHeight = ROW_CONFIG[density].rowHeight + (showPrices ? PRICE_LINE_HEIGHT[density] : 0);
  const chrome =
    TOOLBAR_HEIGHT +
    DATE_HEADER_HEIGHT +
    PAGINATION_BAR_HEIGHT +
    (isFullscreen ? 0 : APP_HEADER_HEIGHT);
  const available = viewportHeight - chrome;
  return Math.max(1, Math.floor(available / rowHeight));
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePlanningPagination({
  totalProperties,
  density,
  isFullscreen,
  showPrices,
}: UsePlanningPaginationConfig): UsePlanningPaginationReturn {
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [currentPage, setCurrentPage] = useState(0);

  // Track viewport height changes
  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pageSize = computePageSize(viewportHeight, density, isFullscreen, showPrices);
  const totalPages = Math.max(1, Math.ceil(totalProperties.length / pageSize));

  // Clamp currentPage when totalPages shrinks (filters, resize, density change)
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentPage]);

  // Reset to page 0 when properties list changes drastically (filter change)
  useEffect(() => {
    setCurrentPage(0);
  }, [totalProperties.length]);

  const paginatedProperties = useMemo(() => {
    const start = currentPage * pageSize;
    return totalProperties.slice(start, start + pageSize);
  }, [totalProperties, currentPage, pageSize]);

  const rangeStart = currentPage * pageSize + 1;
  const rangeEnd = Math.min((currentPage + 1) * pageSize, totalProperties.length);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
    },
    [totalPages],
  );

  const goNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  }, [totalPages]);

  const goPrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  }, []);

  return {
    paginatedProperties,
    currentPage,
    totalPages,
    pageSize,
    rangeStart,
    rangeEnd,
    goToPage,
    goNextPage,
    goPrevPage,
  };
}
