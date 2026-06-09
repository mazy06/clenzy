import React from 'react';
import {
  Box, Paper, Typography, Chip, Tooltip, IconButton, useTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
} from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, MoreVert } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequest } from './serviceRequestsUtils';
import {
  getServiceRequestStatusLabel,
  getServiceRequestStatusHex,
  getServiceRequestPriorityLabel,
  getServiceRequestPriorityHex,
} from '../../utils/statusUtils';
import { stripPropertySuffix, formatDateShort } from './serviceRequestDisplayMapper';
import { LIST_PAPER_SX, PAGINATION_SX } from './serviceRequestsListConstants';

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
  const theme = useTheme();

  return (
    <Paper ref={containerRef} sx={{ ...LIST_PAPER_SX, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TableContainer sx={{ flex: 1, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: theme.palette.text.secondary,
                  borderBottom: `2px solid ${theme.palette.divider}`,
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
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                    {stripPropertySuffix(request.title, request.propertyName)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    {request.propertyName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    {request.propertyAddress}, {request.propertyCity}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    {request.requestorName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    {request.assignedToName || '—'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {(() => { const c = getServiceRequestStatusHex(request.status); return (
                    <Chip
                      label={getServiceRequestStatusLabel(request.status, t)}
                      size="small"
                      sx={{
                        backgroundColor: `${c}18`,
                        color: c,
                        border: `1px solid ${c}40`,
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        height: 24,
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  ); })()}
                </TableCell>
                <TableCell align="center">
                  {(() => { const c = getServiceRequestPriorityHex(request.priority); return (
                    <Chip
                      label={getServiceRequestPriorityLabel(request.priority, t)}
                      size="small"
                      sx={{
                        backgroundColor: `${c}18`,
                        color: c,
                        border: `1px solid ${c}40`,
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        height: 24,
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  ); })()}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                    {request.estimatedCost != null ? convertAndFormat(request.estimatedCost, 'EUR') : '—'}
                  </Typography>
                  {request.estimatedDuration > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                      ~{request.estimatedDuration}h
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
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
