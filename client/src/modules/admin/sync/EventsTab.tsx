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
  Skeleton,
  Alert,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  TablePagination,
} from '@mui/material';
import { syncAdminApi, SyncLog, SyncEventStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/FilterChipRow';
import { useSyncAdminHeader } from '../SyncAdminPage';

type ChannelOption = 'AIRBNB' | 'BOOKING' | 'VRBO' | 'ICAL' | 'OTHER';

// Couleurs de canaux : tokens --airbnb/--booking (baseline §1), marque Vrbo conservée
const CHANNEL_OPTIONS: { value: ChannelOption; label: string; color: string }[] = [
  { value: 'AIRBNB',  label: 'Airbnb',  color: 'var(--airbnb)' },
  { value: 'BOOKING', label: 'Booking', color: 'var(--booking)' },
  { value: 'VRBO',    label: 'Vrbo',    color: '#1E88E5' },
  { value: 'ICAL',    label: 'iCal',    color: 'var(--accent)' },
  { value: 'OTHER',   label: 'Autre',   color: 'var(--muted)' },
];

/** Chip -soft : texte couleur + fond -soft (pilule/typo via thème global MuiChip) */
const chipSx = (fg: string, bg: string) => ({
  color: fg,
  backgroundColor: bg,
  '& .MuiChip-icon': { color: fg },
});

const DIRECTION_TOKEN: Record<string, { fg: string; bg: string }> = {
  INBOUND: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  OUTBOUND: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
};

const STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  SUCCESS: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  ERROR: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  FAILED: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  PENDING: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
};

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

/** Label overline (pattern entête de tuile/section) */
const OVERLINE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
} as const;

const EventsTab: React.FC = () => {
  const [events, setEvents] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<SyncEventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filters
  const [channel, setChannel] = useState<ChannelOption | ''>('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const { setHeaderFilters } = useSyncAdminHeader();

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

  // Register filters (Channel + Status + Depuis) into the page header.
  useEffect(() => {
    setHeaderFilters(
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <FilterChipRow
          options={CHANNEL_OPTIONS}
          value={channel}
          onChange={(v) => { setChannel(v as ChannelOption | ''); setPage(0); }}
          allLabel="Tous"
          size="compact"
        />
        <TextField
          size="small"
          label="Status"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          sx={{ width: 140 }}
        />
        <TextField
          size="small"
          label="Depuis"
          type="datetime-local"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 200 }}
        />
      </Box>,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, channel, status, from]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      {/* Stats Cards — label overline, valeurs display tabular-nums */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={OVERLINE_SX}>Total (24h)</Typography>
                <Typography
                  variant="h4"
                  sx={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {stats.totalLast24h}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ ...OVERLINE_SX, mb: 0.5 }}>Par Channel</Typography>
                {Object.entries(stats.byChannel).map(([ch, count]) => (
                  <Typography key={ch} variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {ch}: {count}
                  </Typography>
                ))}
                {Object.keys(stats.byChannel).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'var(--muted)' }}>Aucune donnee</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ ...OVERLINE_SX, mb: 0.5 }}>Par Status</Typography>
                {Object.entries(stats.byStatus).map(([s, count]) => (
                  <Typography key={s} variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {s}: {count}
                  </Typography>
                ))}
                {Object.keys(stats.byStatus).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'var(--muted)' }}>Aucune donnee</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                            size="small"
                            sx={(() => {
                              const tk = DIRECTION_TOKEN[evt.direction] ?? NEUTRAL_TOKEN;
                              return chipSx(tk.fg, tk.bg);
                            })()}
                          />
                        ) : '—'}
                      </TableCell>
                      <TableCell>{evt.eventType}</TableCell>
                      <TableCell>
                        {evt.status ? (
                          <Chip
                            label={evt.status}
                            size="small"
                            sx={(() => {
                              const tk = STATUS_TOKEN[evt.status] ?? NEUTRAL_TOKEN;
                              return chipSx(tk.fg, tk.bg);
                            })()}
                          />
                        ) : '—'}
                      </TableCell>
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
