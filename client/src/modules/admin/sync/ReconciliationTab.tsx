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
  Alert,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { syncAdminApi, ReconciliationRun, ReconciliationStats } from '../../../services/api/syncAdminApi';

const STATUSES = ['', 'SUCCESS', 'FAILED', 'DIVERGENCE', 'RUNNING'] as const;

const statusColor = (status: string): 'info' | 'success' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'error';
    case 'DIVERGENCE': return 'warning';
    case 'RUNNING': return 'info';
    default: return 'default';
  }
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
  const [statusFilter, setStatusFilter] = useState('');
  const [propertyIdFilter, setPropertyIdFilter] = useState('');

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

  const formatDuration = (startedAt: string | null, completedAt: string | null): string => {
    if (!startedAt || !completedAt) return '—';
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Box>
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Total Runs</Typography>
                <Typography variant="h4">{stats.totalRuns}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Success</Typography>
                <Typography variant="h4" color="success.main">{stats.successRuns}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Failed</Typography>
                <Typography variant="h4" color="error.main">{stats.failedRuns}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Divergence</Typography>
                <Typography variant="h4" color="warning.main">{stats.divergenceRuns}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Discrepancies</Typography>
                <Typography variant="h4">{stats.totalDiscrepancies}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Fixes</Typography>
                <Typography variant="h4" color="success.main">{stats.totalFixes}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters + Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Property ID"
          value={propertyIdFilter}
          onChange={(e) => { setPropertyIdFilter(e.target.value); setPage(0); }}
          type="number"
          sx={{ width: 150 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>{s || 'Tous'}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<PlayArrow />}
          onClick={() => setTriggerDialogOpen(true)}
        >
          Trigger Reconciliation
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {triggerMessage && <Alert severity="info" sx={{ mb: 2 }}>{triggerMessage}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
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
                    <TableCell colSpan={12} align="center">Aucune reconciliation</TableCell>
                  </TableRow>
                ) : (
                  runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{run.id}</TableCell>
                      <TableCell>
                        <Chip label={run.channel} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{run.propertyId}</TableCell>
                      <TableCell>
                        <Chip
                          label={run.status}
                          color={statusColor(run.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{run.pmsDaysChecked}</TableCell>
                      <TableCell>{run.channelDaysChecked}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={run.discrepanciesFound > 0 ? 'warning.main' : 'text.primary'}
                          fontWeight={run.discrepanciesFound > 0 ? 'bold' : 'normal'}
                        >
                          {run.discrepanciesFound}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={run.discrepanciesFixed > 0 ? 'success.main' : 'text.primary'}
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
