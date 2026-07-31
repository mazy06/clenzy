import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Skeleton, Typography, Grid, Card, CardContent, TextField } from '@mui/material';
import { syncAdminApi, SyncLog, SyncEventStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/FilterChipRow';
import { useSyncAdminHeader } from '../SyncAdminPage';
import PagePagination from '../../../components/PagePagination';

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
      <div className="flex items-center gap-2 flex-wrap">
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
      </div>,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, channel, status, from]);

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (rows: number) => {
    setRowsPerPage(rows);
    setPage(0);
  };

  return (
    <div>
      {/* Stats Cards — label overline, valeurs display tabular-nums */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={OVERLINE_SX}>Total (24h)</Typography>
                <h4 className="cn-text-h4 text-[var(--ink)] tabular-nums">
                  {stats.totalLast24h}
                </h4>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ ...OVERLINE_SX, mb: 0.5 }}>Par Channel</Typography>
                {Object.entries(stats.byChannel).map(([ch, count]) => (
                  <p className="cn-text-body2 tabular-nums" key={ch}>
                    {ch}: {count}
                  </p>
                ))}
                {Object.keys(stats.byChannel).length === 0 && (
                  <p className="cn-text-body2 text-[var(--muted)]">Aucune donnee</p>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ ...OVERLINE_SX, mb: 0.5 }}>Par Status</Typography>
                {Object.entries(stats.byStatus).map(([s, count]) => (
                  <p className="cn-text-body2 tabular-nums" key={s}>
                    {s}: {count}
                  </p>
                ))}
                {Object.keys(stats.byStatus).length === 0 && (
                  <p className="cn-text-body2 text-[var(--muted)]">Aucune donnee</p>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {error && <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
          ))}
        </div>
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
                        <p className="cn-text-body2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={evt.errorMessage || undefined}>
                          {evt.errorMessage || '—'}
                        </p>
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
          <PagePagination
            count={totalElements}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </div>
  );
};

export default EventsTab;
