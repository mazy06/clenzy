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
  Checkbox,
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
} from '@mui/material';
import { Replay } from '@mui/icons-material';
import { syncAdminApi, OutboxEvent, OutboxStats } from '../../../services/api/syncAdminApi';

const STATUSES = ['', 'PENDING', 'SENT', 'FAILED'] as const;

const statusColor = (status: string): 'info' | 'success' | 'error' | 'default' => {
  switch (status) {
    case 'PENDING': return 'info';
    case 'SENT': return 'success';
    case 'FAILED': return 'error';
    default: return 'default';
  }
};

const OutboxTab: React.FC = () => {
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [stats, setStats] = useState<OutboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [retrying, setRetrying] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [topic, setTopic] = useState('');

  const fetchStats = async () => {
    try {
      const data = await syncAdminApi.getOutboxStats();
      setStats(data);
    } catch {
      // Stats non-critical
    }
  };

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await syncAdminApi.getOutbox({
        status: statusFilter || undefined,
        topic: topic || undefined,
        page,
        size: rowsPerPage,
      });
      setEvents(data.content);
      setTotalElements(data.totalElements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la outbox');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, topic, page, rowsPerPage]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFailed = () => {
    const failedIds = events.filter((e) => e.status === 'FAILED').map((e) => e.id);
    setSelectedIds(new Set(failedIds));
  };

  const handleRetry = async () => {
    if (selectedIds.size === 0) return;
    try {
      setRetrying(true);
      setRetryMessage(null);
      const result = await syncAdminApi.retryOutboxEvents(Array.from(selectedIds));
      setRetryMessage(
        `Retry: ${result.retried}/${result.requested} reussis` +
        (result.failedIds.length > 0 ? `. Echecs: ${result.failedIds.join(', ')}` : ''),
      );
      setSelectedIds(new Set());
      await fetchEvents();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du retry');
    } finally {
      setRetrying(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    setSelectedIds(new Set());
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    setSelectedIds(new Set());
  };

  return (
    <Box>
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Pending</Typography>
                <Typography variant="h4" color="info.main">{stats.pending}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Sent</Typography>
                <Typography variant="h4" color="success.main">{stats.sent}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Failed</Typography>
                <Typography variant="h4" color="error.main">{stats.failed}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Total</Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters + Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <TextField
          size="small"
          label="Topic"
          value={topic}
          onChange={(e) => { setTopic(e.target.value); setPage(0); }}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={handleSelectAllFailed}
        >
          Select All Failed
        </Button>
        <Button
          size="small"
          variant="contained"
          color="warning"
          startIcon={retrying ? <CircularProgress size={16} /> : <Replay />}
          onClick={handleRetry}
          disabled={selectedIds.size === 0 || retrying}
        >
          Retry Selected ({selectedIds.size})
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {retryMessage && <Alert severity="info" sx={{ mb: 2 }}>{retryMessage}</Alert>}

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
                  <TableCell padding="checkbox" />
                  <TableCell>ID</TableCell>
                  <TableCell>Aggregate</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Topic</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Retry</TableCell>
                  <TableCell>Error</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Sent At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">Aucun event</TableCell>
                  </TableRow>
                ) : (
                  events.map((evt) => (
                    <TableRow key={evt.id} selected={selectedIds.has(evt.id)}>
                      <TableCell padding="checkbox">
                        {evt.status === 'FAILED' && (
                          <Checkbox
                            checked={selectedIds.has(evt.id)}
                            onChange={() => handleToggleSelect(evt.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>{evt.id}</TableCell>
                      <TableCell>{evt.aggregateType}#{evt.aggregateId}</TableCell>
                      <TableCell>{evt.eventType}</TableCell>
                      <TableCell>{evt.topic}</TableCell>
                      <TableCell>
                        <Chip
                          label={evt.status}
                          color={statusColor(evt.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{evt.retryCount}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={evt.errorMessage || undefined}
                        >
                          {evt.errorMessage || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {evt.createdAt ? new Date(evt.createdAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        {evt.sentAt ? new Date(evt.sentAt).toLocaleString() : '—'}
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
    </Box>
  );
};

export default OutboxTab;
