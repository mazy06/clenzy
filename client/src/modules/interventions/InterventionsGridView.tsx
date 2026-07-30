import React from 'react';
import { Grid } from '@mui/material';
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
    <Grid container spacing={2}>
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
            <Grid item xs={12} md={6} lg={4} key={intervention.id}>
              <InterventionCard
                intervention={intervention}
                onMenuOpen={onMenuOpen}
                canEdit={canModifyIntervention(intervention)}
              />
            </Grid>,
          ];
        })}
    </Grid>
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
