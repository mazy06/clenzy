import { useState, useEffect, useMemo, useCallback } from 'react';
import type { PlanningProperty, DensityMode } from '../types';
import {
  ROW_CONFIG,
  DATE_HEADER_HEIGHT,
  OCCUPANCY_ROW_HEIGHT,
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
  /**
   * Mode « accordéon Superviseur » : la 1ʳᵉ page n'affiche QUE le premier
   * logement (son panneau plein écran remplit la hauteur) ; tous les autres
   * logements glissent dans les pages suivantes (pageSize normal).
   */
  firstItemAlone?: boolean;
  /**
   * Hauteur MESURÉE de la boîte de la grille (en-tête des dates + lignes +
   * rangée « Occupation »), publiée par `PlanningTimeline`. Dès qu'elle est
   * connue, elle remplace l'estimation : c'est la seule qui dise la vérité sur
   * un écran dont le chrome n'a pas la forme prévue.
   */
  gridHeight?: number;
  /** La rangée « Occupation » occupe le pied de la grille (elle mange une place). */
  hasOccupancyRow?: boolean;
}

export interface UsePlanningPaginationReturn {
  paginatedProperties: PlanningProperty[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  rangeStart: number;
  rangeEnd: number;
  goToPage: (page: number) => void;
}

// ─── Page size computation ──────────────────────────────────────────────────

// Extra spacing added by the layout: toolbar mb(8) + pagination mt(8) + container pb(8) + border(2)
const LAYOUT_SPACING = 26;

/**
 * Nombre de lignes qui tiennent dans la grille MESURÉE.
 *
 * <p>À préférer toujours à l'estimation ci-dessous : celle-ci soustrait un
 * chrome écrit pour le desktop (barre d'outils sur DEUX rangées, 116 px) alors
 * qu'un téléphone n'en affiche qu'une. Elle retirait donc une bonne cinquantaine
 * de pixels qui existaient — une à deux lignes de logement perdues, remplacées
 * par du blanc au-dessus de la rangée « Occupation » (que son `mt-auto` colle au
 * bas de la carte, rendant l'écart d'autant plus visible).</p>
 */
function pageSizeFromGrid(
  gridHeight: number,
  density: DensityMode,
  hasOccupancyRow: boolean,
): number {
  const rowHeight = ROW_CONFIG[density].rowHeight;
  const available = gridHeight - DATE_HEADER_HEIGHT - (hasOccupancyRow ? OCCUPANCY_ROW_HEIGHT : 0);
  return Math.max(1, Math.floor(available / rowHeight));
}

/** Estimation de repli, le temps que la grille soit mesurée (premier rendu). */
function computePageSize(
  viewportHeight: number,
  density: DensityMode,
  isFullscreen: boolean,
  _showPrices: boolean, // conserve pour la signature, plus utilise (prix in-cell)
): number {
  const rowHeight = ROW_CONFIG[density].rowHeight;
  // The page container height is already `100vh - APP_HEADER_HEIGHT` (or 100vh in fullscreen),
  // so we only subtract the chrome elements *inside* the planning page.
  const chrome =
    TOOLBAR_HEIGHT +
    DATE_HEADER_HEIGHT +
    PAGINATION_BAR_HEIGHT +
    LAYOUT_SPACING;
  const available = viewportHeight - (isFullscreen ? 0 : APP_HEADER_HEIGHT) - chrome;
  return Math.max(1, Math.floor(available / rowHeight));
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePlanningPagination({
  totalProperties,
  density,
  isFullscreen,
  showPrices,
  firstItemAlone = false,
  gridHeight = 0,
  hasOccupancyRow = false,
}: UsePlanningPaginationConfig): UsePlanningPaginationReturn {
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [currentPage, setCurrentPage] = useState(0);

  // Track viewport height changes
  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pageSize = gridHeight > 0
    ? pageSizeFromGrid(gridHeight, density, hasOccupancyRow)
    : computePageSize(viewportHeight, density, isFullscreen, showPrices);
  const itemCount = totalProperties.length;
  const totalPages = firstItemAlone
    ? itemCount <= 1
      ? 1
      : 1 + Math.ceil((itemCount - 1) / pageSize)
    : Math.max(1, Math.ceil(itemCount / pageSize));

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

  // Accordéon Superviseur : revenir page 0 à l'ouverture / fermeture, ou si le
  // logement déployé change (sa propre page doit toujours être la page 1).
  const accordionResetKey = firstItemAlone ? `exp:${totalProperties[0]?.id ?? ''}` : 'off';
  useEffect(() => {
    setCurrentPage(0);
  }, [accordionResetKey]);

  const paginatedProperties = useMemo(() => {
    if (firstItemAlone) {
      if (currentPage === 0) return totalProperties.slice(0, 1);
      const start = 1 + (currentPage - 1) * pageSize;
      return totalProperties.slice(start, start + pageSize);
    }
    const start = currentPage * pageSize;
    return totalProperties.slice(start, start + pageSize);
  }, [totalProperties, currentPage, pageSize, firstItemAlone]);

  let rangeStart: number;
  let rangeEnd: number;
  if (firstItemAlone) {
    if (currentPage === 0) {
      rangeStart = itemCount === 0 ? 0 : 1;
      rangeEnd = itemCount === 0 ? 0 : 1;
    } else {
      const start0 = 1 + (currentPage - 1) * pageSize;
      rangeStart = start0 + 1;
      rangeEnd = Math.min(start0 + pageSize, itemCount);
    }
  } else {
    rangeStart = currentPage * pageSize + 1;
    rangeEnd = Math.min((currentPage + 1) * pageSize, itemCount);
  }

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
    },
    [totalPages],
  );

  return {
    paginatedProperties,
    currentPage,
    totalPages,
    pageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  };
}
