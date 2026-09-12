import React from 'react';
import PagePagination from '../../components/PagePagination';
import { PAGINATION_BAR_HEIGHT } from './constants';

interface PlanningPaginationBarProps {
  currentPage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalProperties: number;
  onPageChange: (page: number) => void;
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
}) => {
  return (
    // La barre reprend toute la largeur : l'encoche de l'assistant, ancrée
    // `bottom-0 right-0`, lui volait 56 px à droite jusqu'à 900px pour ne pas
    // recouvrir le bouton « Suivant ». Elle n'existe plus (l'assistant s'ouvre
    // depuis le logo de la barre latérale), la réserve non plus.
    <div
      className="flex items-center px-3 bg-[var(--bui-card)] shrink-0"
      style={{ height: PAGINATION_BAR_HEIGHT, minHeight: PAGINATION_BAR_HEIGHT, borderTop: '1px solid var(--bui-border)' }}
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
