import React from 'react';
import StatusChip from '../../components/StatusChip';
import { Paper, Tooltip, IconButton } from '@mui/material';
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
import { LIST_PAPER_SX, srStatusTokens, srPriorityTokens } from './serviceRequestsListConstants';
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

  return (
    <Paper ref={containerRef} sx={{ ...LIST_PAPER_SX, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                  <p className="cn-text-body1 text-[13px] font-semibold text-[var(--ink)]">
                    {stripPropertySuffix(request.title, request.propertyName)}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
                    {request.propertyName}
                  </p>
                  <p className="cn-text-body1 text-[11px] text-[var(--muted)]">
                    {request.propertyAddress}, {request.propertyCity}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
                    {request.requestorName}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
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
                  <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] font-[family-name:var(--font-display)] tabular-nums">
                    {request.estimatedCost != null ? <Money value={request.estimatedCost} from="EUR" /> : '—'}
                  </p>
                  {request.estimatedDuration > 0 && (
                    <p className="cn-text-body1 text-[11px] text-[var(--muted)] tabular-nums">
                      ~{request.estimatedDuration}h
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <p className="cn-text-body1 text-[12.5px] text-[var(--body)] tabular-nums">
                    {formatDateShort(request.dueDate)}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  <Tooltip title="Détails">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); navigate(`/service-requests/${request.id}`); }}
                    >
                      <Visibility size={18} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Actions">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); onMenuOpen(e, request); }}
                    >
                      <MoreVert size={18} strokeWidth={1.75} />
                    </IconButton>
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
    </Paper>
  );
};

export default ServiceRequestsTableView;
