import React from 'react';
import PagePagination from '../../components/PagePagination';
import { cn } from '../../utils/cn';
import { PAGINATION_BAR_HEIGHT } from './constants';

interface PlanningPaginationBarProps {
  currentPage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalProperties: number;
  onPageChange: (page: number) => void;
  /**
   * Réserver à droite la place de l'encoche de l'assistant (`AssistantDockTab`,
   * ancrée `bottom-0 right-0`). Faux en plein écran, où l'encoche est démontée.
   */
  reserveAssistantSlot?: boolean;
}

/**
 * Barre de pagination du planning : la pagination UNIQUE du PMS
 * (`PagePagination`) posée dans le bandeau bas, de hauteur fixe
 * `PAGINATION_BAR_HEIGHT` — cette hauteur est réservée par le calcul du
 * pageSize (`usePlanningPagination`), donc la barre reste visible même sur une
 * page unique.
 *
 * Les bornes sont fournies par le hook : en mode accordéon Superviseur la
 * première page ne contient qu'un logement, elles ne se déduisent pas de
 * page × pageSize.
 */
const PlanningPaginationBar: React.FC<PlanningPaginationBarProps> = React.memo(({
  currentPage,
  totalPages,
  rangeStart,
  rangeEnd,
  totalProperties,
  onPageChange,
  reserveAssistantSlot = true,
}) => {
  return (
    <div
      className={cn(
        'flex items-center px-3 bg-[var(--card)] shrink-0',
        // 56px = largeur de l'encoche compacte (`w-[56px] min-[900px]:w-[300px]`),
        // qu'elle garde jusqu'à 900px : sans cette réserve elle recouvrait le
        // bouton « Suivant ». `pr` et non `pe` : l'encoche est ancrée `right-0`,
        // bord physique, y compris en RTL. Au-delà de 900px la barre reprend son
        // `px-3` — l'écran est assez large pour que la pagination centrée reste
        // dégagée.
        reserveAssistantSlot && 'pr-[56px] min-[900px]:pr-3',
      )}
      style={{ height: PAGINATION_BAR_HEIGHT, minHeight: PAGINATION_BAR_HEIGHT, borderTop: '1px solid var(--line)' }}
    >
      <PagePagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        count={totalProperties}
        rangeFrom={rangeStart}
        rangeTo={rangeEnd}
        hideOnSinglePage={false}
        centerNav
        className="w-full py-0"
      />
    </div>
  );
});

PlanningPaginationBar.displayName = 'PlanningPaginationBar';
export default PlanningPaginationBar;
