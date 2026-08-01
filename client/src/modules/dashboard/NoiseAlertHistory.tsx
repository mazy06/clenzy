import React, { useState, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Badge as BuiBadge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Card, CardContent, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, IconButton, Tooltip, FormControl, Select, MenuItem, Badge, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import StatusChip from '../../components/StatusChip';
import {
  History,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '../../icons';
import {
  useNoiseAlerts,
  useUnacknowledgedAlertCount,
  useAcknowledgeAlert,
  type NoiseAlertDto,
} from '../../hooks/useNoiseAlerts';
import PagePagination from '../../components/PagePagination';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function SeverityChip({ severity }: { severity: string }) {
  const isWarning = severity === 'WARNING';
  return (
    <StatusChip
      icon={isWarning ? <Warning size={12} strokeWidth={1.75} /> : <ErrorIcon size={12} strokeWidth={1.75} />}
      label={isWarning ? 'Avertissement' : 'Critique'}
      tone={isWarning ? 'warn' : 'err'}
    />
  );
}

function SourceChip({ source }: { source: string }) {
  const label = source === 'WEBHOOK' ? 'Temps reel' : source === 'SCHEDULER' ? 'Poll' : source;
  return (
    <BuiBadge variant="outline" className="h-[20px] text-[0.625rem] px-0.5">{label}</BuiBadge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NoiseAlertHistoryProps {
  /** Filtre les alertes sur un logement (vue détail d'un appareil). */
  propertyId?: number;
}

const NoiseAlertHistory: React.FC<NoiseAlertHistoryProps> = ({ propertyId }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [severityFilter, setSeverityFilter] = useState<string>('');

  // Acknowledge dialog
  const [ackDialog, setAckDialog] = useState<{ open: boolean; alertId: number | null }>({
    open: false,
    alertId: null,
  });
  const [ackNotes, setAckNotes] = useState('');

  const alertsQuery = useNoiseAlerts({
    propertyId,
    severity: severityFilter || undefined,
    page,
    size: rowsPerPage,
  });
  const countQuery = useUnacknowledgedAlertCount();
  const ackMutation = useAcknowledgeAlert();

  const handleAcknowledge = useCallback(() => {
    if (ackDialog.alertId == null) return;
    ackMutation.mutate(
      { id: ackDialog.alertId, notes: ackNotes || undefined },
      {
        onSuccess: () => {
          setAckDialog({ open: false, alertId: null });
          setAckNotes('');
        },
      },
    );
  }, [ackDialog.alertId, ackNotes, ackMutation]);

  const alerts = alertsQuery.data?.content ?? [];
  const totalElements = alertsQuery.data?.totalElements ?? 0;
  const unacknowledgedCount = countQuery.data ?? 0;

  return (
    <Card>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Badge badgeContent={unacknowledgedCount} color="error" max={99}>
              <span className="inline-flex text-primary"><History size={18} strokeWidth={1.75} /></span>
            </Badge>
            <h6 className="cn-text-subtitle1 font-bold text-[0.875rem]">
              Historique des alertes
            </h6>
          </div>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
              displayEmpty
              sx={{ fontSize: '0.75rem', height: 28 }}
            >
              <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Toutes severites</MenuItem>
              <MenuItem value="WARNING" sx={{ fontSize: '0.75rem' }}>Avertissement</MenuItem>
              <MenuItem value="CRITICAL" sx={{ fontSize: '0.75rem' }}>Critique</MenuItem>
            </Select>
          </FormControl>
        </div>

        {alertsQuery.isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-6" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="cn-text-body1 py-4 text-center text-muted-foreground text-[0.8125rem]">
            Aucune alerte enregistree
          </p>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={headerCellSx}>Date</TableCell>
                    <TableCell sx={headerCellSx}>Propriete</TableCell>
                    <TableCell sx={headerCellSx}>Severite</TableCell>
                    <TableCell sx={headerCellSx} align="right">Mesure</TableCell>
                    <TableCell sx={headerCellSx} align="right">Seuil</TableCell>
                    <TableCell sx={headerCellSx}>Creneau</TableCell>
                    <TableCell sx={headerCellSx}>Source</TableCell>
                    <TableCell sx={headerCellSx} align="center">Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.map((alert: NoiseAlertDto) => (
                    <TableRow key={alert.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={cellSx}>{formatDate(alert.createdAt)}</TableCell>
                      <TableCell sx={cellSx}>{alert.propertyName || `#${alert.propertyId}`}</TableCell>
                      <TableCell sx={cellSx}><SeverityChip severity={alert.severity} /></TableCell>
                      <TableCell sx={cellSx} align="right">
                        <p className={cn('cn-text-body1 font-semibold text-[0.75rem]', alert.severity === 'CRITICAL' ? 'text-[var(--err)]' : 'text-[var(--warn)]')}>
                          {alert.measuredDb.toFixed(0)} dB
                        </p>
                      </TableCell>
                      <TableCell sx={cellSx} align="right">{alert.thresholdDb} dB</TableCell>
                      <TableCell sx={cellSx}>{alert.timeWindowLabel || '—'}</TableCell>
                      <TableCell sx={cellSx}><SourceChip source={alert.source} /></TableCell>
                      <TableCell sx={cellSx} align="center">
                        {alert.acknowledged ? (
                          <Tooltip title={`Acquittee par ${alert.acknowledgedBy || '?'}${alert.notes ? ` — ${alert.notes}` : ''}`}>
                            <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircle size={16} strokeWidth={1.75} /></span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Acquitter">
                            <IconButton
                              size="small"
                              onClick={() => setAckDialog({ open: true, alertId: alert.id })}
                              sx={{ color: 'warning.main' }}
                            >
                              <CheckCircle size={16} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <PagePagination
              count={totalElements}
              page={page}
              onPageChange={(p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
              onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setPage(0); }}
            />
          </>
        )}

        {/* Acknowledge Dialog */}
        <Dialog open={ackDialog.open} onClose={() => setAckDialog({ open: false, alertId: null })} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: '0.95rem' }}>Acquitter l'alerte</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes (optionnel)"
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              sx={{ mt: 1, '& textarea': { fontSize: '0.8125rem' } }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              size="small"
              onClick={() => setAckDialog({ open: false, alertId: null })}
              sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
            >
              Annuler
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleAcknowledge}
              disabled={ackMutation.isPending}
              sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
            >
              {ackMutation.isPending ? 'Acquittement...' : 'Acquitter'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

// ─── Style helpers ───────────────────────────────────────────────────────────

const headerCellSx = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: 'text.secondary',
  textTransform: 'uppercase' as const,
  py: 0.75,
  letterSpacing: '0.04em',
};

const cellSx = {
  fontSize: '0.75rem',
  py: 0.5,
};

export default NoiseAlertHistory;
