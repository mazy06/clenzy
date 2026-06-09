import React from 'react';
import { Grid, TablePagination } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import ServiceRequestCard from '../../components/ServiceRequestCard';
import type { ServiceRequest } from './serviceRequestsUtils';
import { ITEMS_PER_PAGE, PAGINATION_SX } from './serviceRequestsListConstants';

interface ServiceRequestsGridViewProps {
  serviceRequests: ServiceRequest[];
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, request: ServiceRequest) => void;
  typeIcons: { [key: string]: React.ReactElement };
  statuses: Array<{ value: string; label: string }>;
  priorities: Array<{ value: string; label: string }>;
  statusColors: { [key: string]: string };
  priorityColors: { [key: string]: string };
  navigate: NavigateFunction;
}

/** Vue grille : cartes ServiceRequestCard + pagination. */
const ServiceRequestsGridView: React.FC<ServiceRequestsGridViewProps> = ({
  serviceRequests, totalCount, page, onPageChange, onMenuOpen,
  typeIcons, statuses, priorities, statusColors, priorityColors,
}) => (
  <>
    <Grid container spacing={2}>
      {serviceRequests.map((request) => (
        <Grid item xs={12} md={6} lg={4} key={request.id}>
          <ServiceRequestCard
            request={request}
            onMenuOpen={onMenuOpen}
            typeIcons={typeIcons}
            statuses={statuses}
            priorities={priorities}
            statusColors={statusColors}
            priorityColors={priorityColors}
          />
        </Grid>
      ))}
    </Grid>
    {totalCount > ITEMS_PER_PAGE && (
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={ITEMS_PER_PAGE}
        rowsPerPageOptions={[ITEMS_PER_PAGE]}
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        sx={PAGINATION_SX}
      />
    )}
  </>
);

export default ServiceRequestsGridView;
