import React from 'react';

import type { NavigateFunction } from 'react-router-dom';
import ServiceRequestCard from '../../components/baitly/ServiceRequestCard';
import type { ServiceRequest } from './serviceRequestsUtils';
import { statusCssColors, priorityCssColors } from './serviceRequestsUtils';
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

/** Echeance au format de la projection : « 19 août, 11:00 ». */
const formatDue = (d?: string) => {
  if (!d) return undefined;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${jour}, ${heure}`;
};

/** Vue grille : cartes Baitly ServiceRequestCard + pagination. */
const ServiceRequestsGridView: React.FC<ServiceRequestsGridViewProps> = ({
  serviceRequests, totalCount, page, onPageChange, onMenuOpen,
  typeIcons, statuses, priorities, statusColors, priorityColors,
}) => (
  <>
    <div className="grid grid-cols-12 gap-3">
      {serviceRequests.map((request) => (
        <div className="col-span-12 min-[900px]:col-span-6 min-[1200px]:col-span-4" key={request.id} data-highlight-id={String(request.id)}>
          <ServiceRequestCard
            // L'echeance est preformatee (la carte l'affiche telle quelle),
            // les couleurs passees sont les jetons CSS, et type / statut /
            // priorite remontent en MAJUSCULES : les listes d'options et les
            // icones sont indexees ainsi, or la donnee circule parfois en
            // minuscules (« high » restait brut a l'ecran).
            request={{
              ...request,
              type: request.type?.toUpperCase(),
              status: request.status?.toUpperCase(),
              priority: request.priority?.toUpperCase(),
              dueDate: formatDue(request.dueDate),
            }}
            onMenuOpen={(e) => onMenuOpen(e, request)}
            typeIcons={typeIcons}
            statuses={statuses}
            priorities={priorities}
            statusColors={statusCssColors}
            priorityColors={priorityCssColors}
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
