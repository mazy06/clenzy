import React from 'react';
import { Chip, Tooltip, IconButton, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
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
import { LIST_PAPER_SX, stripPropertySuffix, formatDateShort, getProgress } from './interventionsListConstants';
import PagePagination from '../../components/PagePagination';

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
                    <p className="cn-text-body2 font-semibold text-[0.82rem]">
                      {stripPropertySuffix(intervention.title, intervention.propertyName)}
                    </p>
                    <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                      {intervention.requestorName}
                    </span>
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
                    <p className="cn-text-body2 text-[0.82rem]">
                      {intervention.propertyName}
                    </p>
                    <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                      {intervention.propertyAddress}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-[0.82rem]">
                      {intervention.assignedToName || '—'}
                    </p>
                    {intervention.assignedToType && (
                      <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                        {intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}
                      </span>
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
                    <div className="flex items-center gap-1 min-w-[80px]">
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
                      <span className="cn-text-caption font-semibold text-[0.68rem] min-w-[28px] tabular-nums">
                        {getProgress(intervention)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-[0.82rem]">
                      {formatDateShort(intervention.scheduledDate)}
                    </p>
                    {intervention.estimatedDurationHours > 0 && (
                      <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                        ~{intervention.estimatedDurationHours}h
                      </span>
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
      <PagePagination
        count={totalCount}
        page={page}
        onPageChange={(p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
      />
    </Paper>
  );
};

export default InterventionsTableView;
