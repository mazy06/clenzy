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

    // Hauteurs MESURÉES quand la table est déjà rendue ; les options ne servent
    // qu'au premier calcul, avant que la table existe. Une constante finit
    // toujours par mentir : les lignes des réservations font 73 px (cellule à
    // deux niveaux) contre les 49 annoncés. Le compte était donc trop
    // optimiste, et comme le cadre clippe sans défiler, les dernières lignes
    // devenaient inatteignables — la pagination annonçait « 1-13 sur 25 » avec
    // 9 lignes visibles. Le défaut ne venait pas de l'étroitesse : il touchait
    // aussi le grand écran.
    const bodyRow = el.querySelector('tbody tr');
    const headRow = el.querySelector('thead tr');
    const measuredRow = bodyRow instanceof HTMLElement && bodyRow.offsetHeight > 0
      ? bodyRow.offsetHeight
      : rowHeight;
    const measuredHead = headRow instanceof HTMLElement && headRow.offsetHeight > 0
      ? headRow.offsetHeight
      : headerHeight;

    const rect = el.getBoundingClientRect();
    const available = window.innerHeight - rect.top - bottomChrome;
    const rows = Math.floor((available - measuredHead) / measuredRow);
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

    // Les données arrivent souvent APRÈS ce premier calcul : sans ce guet, la
    // mesure porterait sur une table encore vide et retomberait sur la
    // constante. Le recalcul converge en un tour (même hauteur de ligne → même
    // valeur → `setPageSize` sans effet).
    let raf = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    });
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [compute]);

  return { containerRef, pageSize };
}
