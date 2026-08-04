import React from 'react';
import { Button } from '../../components/ui';
import { ChevronLeft, ChevronRight } from '../../icons';
import { PAGINATION_BAR_HEIGHT } from './constants';

interface PlanningPaginationBarProps {
  currentPage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalProperties: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const PlanningPaginationBar: React.FC<PlanningPaginationBarProps> = React.memo(({
  currentPage,
  totalPages,
  rangeStart,
  rangeEnd,
  totalProperties,
  onPrevPage,
  onNextPage,
}) => {
  return (
    <div className="flex items-center justify-center gap-3 px-3 bg-[var(--card)] shrink-0" style={{ height: PAGINATION_BAR_HEIGHT, minHeight: PAGINATION_BAR_HEIGHT, borderTop: '1px solid var(--line)' }}>
      {/* Prev */}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Page précédente"
        onClick={onPrevPage}
        disabled={currentPage === 0}
        className="size-[22px] text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--hover)]"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
      </Button>

      {/* Page indicator */}
      <p className="cn-text-body2 font-[family-name:var(--font-display)] text-[11.5px] font-semibold text-[var(--ink)] tabular-nums select-none">
        Page {currentPage + 1} / {totalPages}
      </p>

      {/* Next */}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Page suivante"
        onClick={onNextPage}
        disabled={currentPage >= totalPages - 1}
        className="size-[22px] text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--hover)]"
      >
        <ChevronRight size={14} strokeWidth={1.75} />
      </Button>

      {/* Range info */}
      <span className="cn-text-caption text-[10.5px] text-[var(--muted)] tabular-nums ms-1.5">
        {rangeStart}-{rangeEnd} sur {totalProperties} logements
      </span>
    </div>
  );
});

PlanningPaginationBar.displayName = 'PlanningPaginationBar';
export default PlanningPaginationBar;
