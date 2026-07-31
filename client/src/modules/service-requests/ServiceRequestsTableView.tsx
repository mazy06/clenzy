import React from 'react';
import { Paper, Chip, Tooltip, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, MoreVert } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequest } from './serviceRequestsUtils';
import {
  getServiceRequestStatusLabel,
  getServiceRequestPriorityLabel,
} from '../../utils/statusUtils';
import { stripPropertySuffix, formatDateShort } from './serviceRequestDisplayMapper';
import { LIST_PAPER_SX, srStatusChipSx, srPriorityChipSx } from './serviceRequestsListConstants';
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
      <TableContainer sx={{ flex: 1, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  fontWeight: 700,
                  fontSize: '10.5px',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--faint)',
                  borderBottom: '1px solid var(--line)',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <TableCell>Titre</TableCell>
              <TableCell>Propriété</TableCell>
              <TableCell>Demandeur</TableCell>
              <TableCell>Assigné à</TableCell>
              <TableCell align="center">Statut</TableCell>
              <TableCell align="center">Priorité</TableCell>
              <TableCell align="right">Coût</TableCell>
              <TableCell>Échéance</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {serviceRequests.map((request) => (
              <TableRow
                key={request.id}
                data-highlight-id={String(request.id)}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { borderBottom: 0 },
                }}
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
                <TableCell align="center">
                  <Chip
                    label={getServiceRequestStatusLabel(request.status, t)}
                    size="small"
                    sx={srStatusChipSx(request.status)}
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={getServiceRequestPriorityLabel(request.priority, t)}
                    size="small"
                    sx={srPriorityChipSx(request.priority)}
                  />
                </TableCell>
                <TableCell align="right">
                  <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] font-[var(--font-display)] tabular-nums">
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
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
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
      </TableContainer>
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
