import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Skeleton,
  Alert,
  Typography,
  Grid,
  TextField,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PlayArrow,
  CompareArrows,
  CheckCircle,
  ErrorOutline,
  WarningAmber,
  Tune,
  AutoFixHigh,
} from '../../../icons';
import { syncAdminApi, ReconciliationRun, ReconciliationStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/FilterChipRow';
import StatTile from '../../../components/StatTile';
import { useSyncAdminHeader } from '../SyncAdminPage';

type ReconciliationStatus = 'SUCCESS' | 'FAILED' | 'DIVERGENCE' | 'RUNNING';

const STATUS_OPTIONS: { value: ReconciliationStatus; label: string; color: string }[] = [
  { value: 'SUCCESS',    label: 'Success',    color: 'var(--ok)' },
  { value: 'FAILED',     label: 'Failed',     color: 'var(--err)' },
  { value: 'DIVERGENCE', label: 'Divergence', color: 'var(--warn)' },
  { value: 'RUNNING',    label: 'Running',    color: 'var(--info)' },
];

// Statuts de run → tokens sémantiques (chips -soft : texte couleur + fond -soft)
const STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  SUCCESS: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  FAILED: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  DIVERGENCE: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  RUNNING: { fg: 'var(--info)', bg: 'var(--info-soft)' },
};

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

const formatDuration = (startedAt: string | null, completedAt: string | null): string => {
  if (!startedAt || !completedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const ReconciliationTab: React.FC = () => {
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | ''>('');
  const [propertyIdFilter, setPropertyIdFilter] = useState('');
  const { setHeaderFilters, setHeaderActions } = useSyncAdminHeader();

  // Trigger dialog
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [triggerPropertyId, setTriggerPropertyId] = useState('');
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const data = await syncAdminApi.getReconciliationStats();
      setStats(data);
    } catch {
      // Stats non-critical
    }
  };

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await syncAdminApi.getReconciliationRuns({
        propertyId: propertyIdFilter ? Number(propertyIdFilter) : undefined,
        status: statusFilter || undefined,
        page,
        size: rowsPerPage,
      });
      setRuns(data.content);
      setTotalElements(data.totalElements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des reconciliations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, propertyIdFilter, page, rowsPerPage]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Register Property ID + Status filters in the page header.
  useEffect(() => {
    setHeaderFilters(
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Property ID"
          value={propertyIdFilter}
          onChange={(e) => { setPropertyIdFilter(e.target.value); setPage(0); }}
          type="number"
          sx={{ width: 150 }}
        />
        <FilterChipRow
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as ReconciliationStatus | ''); setPage(0); }}
          allLabel="Tous"
          size="compact"
        />
      </Box>,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, propertyIdFilter, statusFilter]);

  // Register Trigger Reconciliation button in the page header actions.
  useEffect(() => {
    setHeaderActions(
      <Button
        size="small"
        variant="contained"
        color="primary"
        startIcon={<PlayArrow />}
        onClick={() => setTriggerDialogOpen(true)}
      >
        Trigger Reconciliation
      </Button>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleTrigger = async () => {
    if (!triggerPropertyId) return;
    try {
      setTriggerLoading(true);
      setTriggerMessage(null);
      const result = await syncAdminApi.triggerReconciliation(Number(triggerPropertyId));
      setTriggerMessage(result.message);
      setTriggerDialogOpen(false);
      setTriggerPropertyId('');
      // Refresh after a short delay to let the async reconciliation start
      setTimeout(() => {
        fetchRuns();
        fetchStats();
      }, 2000);
    } catch (err) {
      setTriggerMessage(err instanceof Error ? err.message : 'Erreur lors du declenchement');
    } finally {
      setTriggerLoading(false);
    }
  };

  return (
    <Box>
      {/* Stats — StatTile (carte plate hairline, valeur display tabular-nums) */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={2}>
            <StatTile icon={<CompareArrows />} label="Total Runs" value={stats.totalRuns} color="#6B8A9A" />
          </Grid>
          <Grid item xs={6} sm={2}>
            <StatTile icon={<CheckCircle />} label="Success" value={stats.successRuns} color="#4A9B8E" />
          </Grid>
          <Grid item xs={6} sm={2}>
            <StatTile icon={<ErrorOutline />} label="Failed" value={stats.failedRuns} color="#C97A7A" />
          </Grid>
          <Grid item xs={6} sm={2}>
            <StatTile icon={<WarningAmber />} label="Divergence" value={stats.divergenceRuns} color="#D4A574" />
          </Grid>
          <Grid item xs={6} sm={2}>
            <StatTile icon={<Tune />} label="Discrepancies" value={stats.totalDiscrepancies} color="#7BA3C2" />
          </Grid>
          <Grid item xs={6} sm={2}>
            <StatTile icon={<AutoFixHigh />} label="Fixes" value={stats.totalFixes} color="#4A9B8E" />
          </Grid>
        </Grid>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {triggerMessage && <Alert severity="info" sx={{ mb: 2 }}>{triggerMessage}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
          ))}
        </Box>
      ) : (
        <>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ borderRadius: '14px', borderColor: 'var(--line)' }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>PMS Days</TableCell>
                  <TableCell>Channel Days</TableCell>
                  <TableCell>Discrepancies</TableCell>
                  <TableCell>Fixed</TableCell>
                  <TableCell>Divergence</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Started At</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ color: 'var(--muted)', py: 3 }}>
                      Aucune reconciliation
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{run.id}</TableCell>
                      <TableCell>
                        <Chip
                          label={run.channel}
                          size="small"
                          sx={{ color: NEUTRAL_TOKEN.fg, backgroundColor: NEUTRAL_TOKEN.bg }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{run.propertyId}</TableCell>
                      <TableCell>
                        <Chip
                          label={run.status}
                          size="small"
                          sx={(() => {
                            const tk = STATUS_TOKEN[run.status] ?? NEUTRAL_TOKEN;
                            return { color: tk.fg, backgroundColor: tk.bg };
                          })()}
                        />
                      </TableCell>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{run.pmsDaysChecked}</TableCell>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{run.channelDaysChecked}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            color: run.discrepanciesFound > 0 ? 'var(--warn)' : 'var(--body)',
                            fontWeight: run.discrepanciesFound > 0 ? 600 : 400,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {run.discrepanciesFound}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            color: run.discrepanciesFixed > 0 ? 'var(--ok)' : 'var(--body)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {run.discrepanciesFixed}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {run.divergencePct ? `${run.divergencePct}%` : '0%'}
                      </TableCell>
                      <TableCell>{formatDuration(run.startedAt, run.completedAt)}</TableCell>
                      <TableCell>
                        {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={run.errorMessage || undefined}
                        >
                          {run.errorMessage || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </>
      )}

      {/* Trigger Dialog */}
      <Dialog open={triggerDialogOpen} onClose={() => setTriggerDialogOpen(false)}>
        <DialogTitle>Trigger Reconciliation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Declencher une reconciliation manuelle pour une propriete.
            Tous les mappings actifs de cette propriete seront reconcilies.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Property ID"
            type="number"
            value={triggerPropertyId}
            onChange={(e) => setTriggerPropertyId(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTriggerDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleTrigger}
            disabled={!triggerPropertyId || triggerLoading}
            startIcon={triggerLoading ? <CircularProgress size={16} /> : <PlayArrow />}
          >
            Lancer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReconciliationTab;
