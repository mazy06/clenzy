import React from 'react';
import StatusChip from '../../components/StatusChip';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, MoreVert } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequest } from './serviceRequestsUtils';
import {
  getServiceRequestStatusLabel,
  getServiceRequestPriorityLabel,
} from '../../utils/statusUtils';
import { stripPropertySuffix, formatDateShort } from './serviceRequestDisplayMapper';
import { srStatusTokens, srPriorityTokens } from './serviceRequestsListConstants';
import { Money } from '../../components/Money';
import PagePagination from '../../components/PagePagination';

interface ServiceRequestsTableViewProps {
  serviceRequests: ServiceRequest[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  containerRef: React.Ref<HTMLDivElement>;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, request: ServiceRequest) => void;
  navigate: NavigateFunction;
}

/** Vue liste : tableau dense des demandes de service + pagination. */
const ServiceRequestsTableView: React.FC<ServiceRequestsTableViewProps> = ({
  serviceRequests, totalCount, page, rowsPerPage, onPageChange,
  containerRef, onMenuOpen, navigate,
}) => {
  const { t } = useTranslation();

  // Report en classes de LIST_PAPER_SX (hairline, rayon xl, surface de carte, sans ombre).
  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-solid border-border bg-card shadow-none"
    >
      <div className="flex-1 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Propriété</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Assigné à</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-center">Priorité</TableHead>
              <TableHead className="text-end">Coût</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {serviceRequests.map((request) => (
              <TableRow
                key={request.id}
                data-highlight-id={String(request.id)}
                className="cursor-pointer"
                onClick={() => navigate(`/service-requests/${request.id}`)}
              >
                <TableCell>
                  <p className="text-[13px] font-semibold text-foreground">
                    {stripPropertySuffix(request.title, request.propertyName)}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-[12.5px] text-foreground">
                    {request.propertyName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {request.propertyAddress}, {request.propertyCity}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-[12.5px] text-foreground">
                    {request.requestorName}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-[12.5px] text-foreground">
                    {request.assignedToName || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  <StatusChip pill tokens={srStatusTokens(request.status)} label={getServiceRequestStatusLabel(request.status, t)} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusChip pill tokens={srPriorityTokens(request.priority)} label={getServiceRequestPriorityLabel(request.priority, t)} />
                </TableCell>
                <TableCell className="text-end">
                  <p className="text-[12.5px] font-semibold text-foreground font-[family-name:var(--font-display)] tabular-nums">
                    {request.estimatedCost != null ? <Money value={request.estimatedCost} from="EUR" /> : '—'}
                  </p>
                  {request.estimatedDuration > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      ~{request.estimatedDuration}h
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-[12.5px] text-foreground tabular-nums">
                    {formatDateShort(request.dueDate)}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  {/* Declencheur = <span> natif : les primitives du kit ne
                      transmettent pas de ref (React 18), le tooltip n'aurait
                      pas d'ancre. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Détails"
                          onClick={(e) => { e.stopPropagation(); navigate(`/service-requests/${request.id}`); }}
                        >
                          <Visibility size={18} strokeWidth={1.75} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Détails</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Actions"
                          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, request); }}
                        >
                          <MoreVert size={18} strokeWidth={1.75} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Actions</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PagePagination
        count={totalCount}
        page={page}
        onPageChange={(p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
      />
    </div>
  );
};

export default ServiceRequestsTableView;
