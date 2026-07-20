import React from 'react';
import { Grid, TablePagination } from '@mui/material';
import InterventionCard from './InterventionCard';
import type { Intervention } from './useInterventionsList';
import { PAGINATION_SX } from './interventionsListConstants';

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
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={itemsPerPage}
        rowsPerPageOptions={[itemsPerPage]}
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        sx={PAGINATION_SX}
      />
    )}
  </>
);

export default InterventionsGridView;
