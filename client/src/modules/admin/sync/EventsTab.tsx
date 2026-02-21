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
import { syncAdminApi, SyncLog, SyncEventStats } from '../../../services/api/syncAdminApi';

const CHANNELS = ['', 'AIRBNB', 'BOOKING', 'VRBO', 'ICAL', 'OTHER'] as const;

const directionColor = (direction: string | null): 'info' | 'warning' | 'default' => {
  switch (direction) {
    case 'INBOUND': return 'info';
    case 'OUTBOUND': return 'warning';
    default: return 'default';
  }
};

const EventsTab: React.FC = () => {
  const [events, setEvents] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<SyncEventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filters
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');

  const fetchStats = async () => {
    try {
      const data = await syncAdminApi.getEventStats();
      setStats(data);
    } catch {
      // Stats are non-critical, silently fail
    }
  };

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await syncAdminApi.getEvents({
        channel: channel || undefined,
        status: status || undefined,
        from: from || undefined,
        page,
        size: rowsPerPage,
      });
      setEvents(data.content);
      setTotalElements(data.totalElements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des events');
    } finally {
      setLoading(false);
    }
  }, [channel, status, from, page, rowsPerPage]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Total (24h)</Typography>
                <Typography variant="h4">{stats.totalLast24h}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Par Channel</Typography>
                {Object.entries(stats.byChannel).map(([ch, count]) => (
                  <Typography key={ch} variant="body2">{ch}: {count}</Typography>
                ))}
                {Object.keys(stats.byChannel).length === 0 && (
                  <Typography variant="body2" color="text.secondary">Aucune donnee</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Par Status</Typography>
                {Object.entries(stats.byStatus).map(([s, count]) => (
                  <Typography key={s} variant="body2">{s}: {count}</Typography>
                ))}
                {Object.keys(stats.byStatus).length === 0 && (
                  <Typography variant="body2" color="text.secondary">Aucune donnee</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Channel</InputLabel>
          <Select
            value={channel}
            label="Channel"
            onChange={(e) => { setChannel(e.target.value); setPage(0); }}
          >
            {CHANNELS.map((ch) => (
              <MenuItem key={ch} value={ch}>{ch || 'Tous'}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Status"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
        />
        <TextField
          size="small"
          label="Depuis"
          type="datetime-local"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                  <TableCell>Direction</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Error</TableCell>
                  <TableCell>Duration (ms)</TableCell>
                  <TableCell>Created At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">Aucun event</TableCell>
                  </TableRow>
                ) : (
                  events.map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell>{evt.id}</TableCell>
                      <TableCell>{evt.channel || '—'}</TableCell>
                      <TableCell>
                        {evt.direction ? (
                          <Chip
                            label={evt.direction}
                            color={directionColor(evt.direction)}
                            size="small"
                          />
                        ) : '—'}
                      </TableCell>
                      <TableCell>{evt.eventType}</TableCell>
                      <TableCell>{evt.status}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={evt.errorMessage || undefined}
                        >
                          {evt.errorMessage || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{evt.durationMs}</TableCell>
                      <TableCell>
                        {evt.createdAt ? new Date(evt.createdAt).toLocaleString() : '—'}
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

export default EventsTab;
