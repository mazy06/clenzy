import React from 'react';
import {
  Box, Typography, Chip, Tooltip, IconButton, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
} from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility as VisibilityIcon, MoreVert } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { Intervention } from './useInterventionsList';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';
import { getStatusTokens, getPriorityTokens, getTypeTokens } from './interventionUtils';
import { LIST_PAPER_SX, PAGINATION_SX, stripPropertySuffix, formatDateShort, getProgress } from './interventionsListConstants';

interface InterventionsTableViewProps {
  interventions: Intervention[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => void;
  containerRef: React.Ref<HTMLDivElement>;
  navigate: NavigateFunction;
}

/** Vue liste : tableau dense des interventions + pagination. */
const InterventionsTableView: React.FC<InterventionsTableViewProps> = ({
  interventions, totalCount, page, rowsPerPage, onPageChange, onMenuOpen, containerRef, navigate,
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
                  fontSize: '0.65625rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--faint)',
                  borderBottom: '1px solid var(--line)',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <TableCell>Titre</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Propriété</TableCell>
              <TableCell>Assigné à</TableCell>
              <TableCell align="center">Statut</TableCell>
              <TableCell align="center">Priorité</TableCell>
              <TableCell align="center">Progression</TableCell>
              <TableCell>Planifié le</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {interventions.map((intervention) => {
              if (!intervention?.id) return null;
              return (
                <TableRow
                  key={intervention.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '&:last-child td': { borderBottom: 0 },
                  }}
                  onClick={() => navigate(`/interventions/${intervention.id}`)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                      {stripPropertySuffix(intervention.title, intervention.propertyName)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                      {intervention.requestorName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {(() => { const tk = getTypeTokens(intervention.type); return (
                    <Chip
                      label={getInterventionTypeLabel(intervention.type, t)}
                      size="small"
                      sx={{
                        backgroundColor: tk.bg,
                        color: tk.color,
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.62rem',
                        height: 22,
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                    ); })()}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                      {intervention.propertyName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                      {intervention.propertyAddress}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                      {intervention.assignedToName || '—'}
                    </Typography>
                    {intervention.assignedToType && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {(() => { const tk = getStatusTokens(intervention.status); return (
                      <Chip
                        label={getInterventionStatusLabel(intervention.status, t)}
                        size="small"
                        sx={{
                          backgroundColor: tk.bg,
                          color: tk.color,
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
                    {(() => { const tk = getPriorityTokens(intervention.priority); return (
                      <Chip
                        label={getInterventionPriorityLabel(intervention.priority, t)}
                        size="small"
                        sx={{
                          backgroundColor: tk.bg,
                          color: tk.color,
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 80 }}>
                      <LinearProgress
                        variant="determinate"
                        value={getProgress(intervention)}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'var(--hover)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: getProgress(intervention) === 100 ? 'var(--ok)'
                              : getProgress(intervention) >= 50 ? 'var(--info)' : 'var(--warn)',
                          },
                        }}
                      />
                      <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.68rem', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>
                        {getProgress(intervention)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                      {formatDateShort(intervention.scheduledDate)}
                    </Typography>
                    {intervention.estimatedDurationHours > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        ~{intervention.estimatedDurationHours}h
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Détails">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                      >
                        <VisibilityIcon size={18} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Actions">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onMenuOpen(e, intervention); }}
                      >
                        <MoreVert size={18} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
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

export default InterventionsTableView;
