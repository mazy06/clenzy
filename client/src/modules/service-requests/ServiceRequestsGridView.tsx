import React from 'react';

import type { NavigateFunction } from 'react-router-dom';
import ServiceRequestCard from '../../components/ServiceRequestCard';
import type { ServiceRequest } from './serviceRequestsUtils';
import { ITEMS_PER_PAGE } from './serviceRequestsListConstants';
import PagePagination from '../../components/PagePagination';

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
    <div className="grid grid-cols-12 gap-3">
      {serviceRequests.map((request) => (
        <div className="col-span-12 min-[900px]:col-span-6 min-[1200px]:col-span-4" key={request.id} data-highlight-id={String(request.id)}>
          <ServiceRequestCard
            request={request}
            onMenuOpen={onMenuOpen}
            typeIcons={typeIcons}
            statuses={statuses}
            priorities={priorities}
            statusColors={statusColors}
            priorityColors={priorityColors}
          />
        </div>
      ))}
    </div>
    {totalCount > ITEMS_PER_PAGE && (
      <PagePagination
        count={totalCount}
        page={page}
        onPageChange={(p) => onPageChange(p)}
        rowsPerPage={ITEMS_PER_PAGE}
      />
    )}
  </>
);

export default ServiceRequestsGridView;
