import React from 'react';
import {
  Paper, Typography, Chip, Tooltip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
} from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, MoreVert } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequest } from './serviceRequestsUtils';
import {
  getServiceRequestStatusLabel,
  getServiceRequestPriorityLabel,
} from '../../utils/statusUtils';
import { stripPropertySuffix, formatDateShort } from './serviceRequestDisplayMapper';
import { LIST_PAPER_SX, PAGINATION_SX, srStatusChipSx, srPriorityChipSx } from './serviceRequestsListConstants';

interface ServiceRequestsTableViewProps {
  serviceRequests: ServiceRequest[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  containerRef: React.Ref<HTMLDivElement>;
  convertAndFormat: (amount: number | null | undefined, fromCurrency?: string) => string;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, request: ServiceRequest) => void;
  navigate: NavigateFunction;
}

/** Vue liste : tableau dense des demandes de service + pagination. */
const ServiceRequestsTableView: React.FC<ServiceRequestsTableViewProps> = ({
  serviceRequests, totalCount, page, rowsPerPage, onPageChange,
  containerRef, convertAndFormat, onMenuOpen, navigate,
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
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { borderBottom: 0 },
                }}
                onClick={() => navigate(`/service-requests/${request.id}`)}
              >
                <TableCell>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                    {stripPropertySuffix(request.title, request.propertyName)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: '12.5px', color: 'var(--body)' }}>
                    {request.propertyName}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {request.propertyAddress}, {request.propertyCity}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: '12.5px', color: 'var(--body)' }}>
                    {request.requestorName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: '12.5px', color: 'var(--body)' }}>
                    {request.assignedToName || '—'}
                  </Typography>
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
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                    {request.estimatedCost != null ? convertAndFormat(request.estimatedCost, 'EUR') : '—'}
                  </Typography>
                  {request.estimatedDuration > 0 && (
                    <Typography sx={{ fontSize: '11px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      ~{request.estimatedDuration}h
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: '12.5px', color: 'var(--body)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDateShort(request.dueDate)}
                  </Typography>
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
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[]}
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        sx={{ ...PAGINATION_SX, flexShrink: 0 }}
      />
    </Paper>
  );
};

export default ServiceRequestsTableView;
