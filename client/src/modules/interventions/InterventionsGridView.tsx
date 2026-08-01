import React from 'react';

import InterventionCard from './InterventionCard';
import type { Intervention } from './useInterventionsList';
import PagePagination from '../../components/PagePagination';

interface InterventionsGridViewProps {
  interventions: Intervention[];
  totalCount: number;
  page: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => void;
  canModifyIntervention: (intervention: Intervention) => boolean;
}

/** Vue grille : cartes InterventionCard + pagination fixe. */
const InterventionsGridView: React.FC<InterventionsGridViewProps> = ({
  interventions, totalCount, page, itemsPerPage, onPageChange, onMenuOpen, canModifyIntervention,
}) => (
  <>
    <div className="grid grid-cols-12 gap-3">
      {interventions
        .flatMap((intervention) => {
          if (
            !intervention ||
            typeof intervention !== 'object' ||
            !intervention.id ||
            !intervention.title ||
            !intervention.description ||
            !intervention.type ||
            !intervention.status ||
            !intervention.priority
          ) {
            return [];
          }
          return [
            <div className="col-span-12 min-[900px]:col-span-6 min-[1200px]:col-span-4" key={intervention.id}>
              <InterventionCard
                intervention={intervention}
                onMenuOpen={onMenuOpen}
                canEdit={canModifyIntervention(intervention)}
              />
            </div>,
          ];
        })}
    </div>
    {totalCount > itemsPerPage && (
      <PagePagination
        count={totalCount}
        page={page}
        onPageChange={(p) => onPageChange(p)}
        rowsPerPage={itemsPerPage}
      />
    )}
  </>
);

export default InterventionsGridView;
