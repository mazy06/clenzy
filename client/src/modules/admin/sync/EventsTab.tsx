import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Skeleton, Card, CardContent } from '@mui/material';
import { Field, FieldLabel, Input } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { syncAdminApi, SyncLog, SyncEventStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/FilterChipRow';
import { useSyncAdminHeader } from '../SyncAdminPage';
import PagePagination from '../../../components/PagePagination';
import StatusChip, { type ToneTokens } from '../../../components/StatusChip';

type ChannelOption = 'AIRBNB' | 'BOOKING' | 'VRBO' | 'ICAL' | 'OTHER';

// Couleurs de canaux : tokens --airbnb/--booking (baseline §1), marque Vrbo conservée
const CHANNEL_OPTIONS: { value: ChannelOption; label: string; color: string }[] = [
  { value: 'AIRBNB',  label: 'Airbnb',  color: 'var(--airbnb)' },
  { value: 'BOOKING', label: 'Booking', color: 'var(--booking)' },
  { value: 'VRBO',    label: 'Vrbo',    color: '#1E88E5' },
  { value: 'ICAL',    label: 'iCal',    color: 'var(--accent)' },
  { value: 'OTHER',   label: 'Autre',   color: 'var(--muted)' },
];

const DIRECTION_TOKEN: Record<string, ToneTokens> = {
  INBOUND: { color: 'var(--info)', bg: 'var(--info-soft)' },
  OUTBOUND: { color: 'var(--warn)', bg: 'var(--warn-soft)' },
};

const STATUS_TOKEN: Record<string, ToneTokens> = {
  SUCCESS: { color: 'var(--ok)', bg: 'var(--ok-soft)' },
  ERROR: { color: 'var(--err)', bg: 'var(--err-soft)' },
  FAILED: { color: 'var(--err)', bg: 'var(--err-soft)' },
  PENDING: { color: 'var(--warn)', bg: 'var(--warn-soft)' },
};

const NEUTRAL_TOKEN: ToneTokens = { color: 'var(--muted)', bg: 'var(--hover)' };

/** Label overline (pattern entête de tuile/section) */
const OVERLINE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
} as const;

/** Report en classes de `OVERLINE_SX`. */
const OVERLINE_CLASS = 'text-[10.5px] font-bold tracking-[.05em] uppercase text-[var(--faint)]';

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
        {/* Largeurs figees : ces filtres vivent dans une rangee flex, le `w-full`
            du kit les etalerait chacun sur toute la largeur du header. */}
        <Field className="w-[140px]">
          <FieldLabel htmlFor="sync-events-status">Status</FieldLabel>
          <Input
            id="sync-events-status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          />
        </Field>
        <Field className="w-[200px]">
          <FieldLabel htmlFor="sync-events-from">Depuis</FieldLabel>
          <Input
            id="sync-events-from"
            type="datetime-local"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(0); }}
          />
        </Field>
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
        <div className="grid grid-cols-12 gap-3 mb-[18px]">
          <div className="col-span-12 min-[600px]:col-span-4">
            <Card variant="outlined">
              <CardContent>
                <p className={cn(OVERLINE_CLASS, 'cn-text-body1')}>Total (24h)</p>
                <h4 className="cn-text-h4 text-[var(--ink)] tabular-nums">
                  {stats.totalLast24h}
                </h4>
              </CardContent>
            </Card>
          </div>
          <div className="col-span-12 min-[600px]:col-span-4">
            <Card variant="outlined">
              <CardContent>
                <p className={cn(OVERLINE_CLASS, 'cn-text-body1 mb-[3px]')}>Par Channel</p>
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
          </div>
          <div className="col-span-12 min-[600px]:col-span-4">
            <Card variant="outlined">
              <CardContent>
                <p className={cn(OVERLINE_CLASS, 'cn-text-body1 mb-[3px]')}>Par Status</p>
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
          </div>
        </div>
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
          <div className="overflow-x-auto rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Duration (ms)</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Aucun event</TableCell>
                  </TableRow>
                ) : (
                  events.map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell>{evt.id}</TableCell>
                      <TableCell>{evt.channel || '—'}</TableCell>
                      <TableCell>
                        {evt.direction ? (
                          <StatusChip
                            label={evt.direction}
                            tokens={DIRECTION_TOKEN[evt.direction] ?? NEUTRAL_TOKEN}
                          />
                        ) : '—'}
                      </TableCell>
                      <TableCell>{evt.eventType}</TableCell>
                      <TableCell>
                        {evt.status ? (
                          <StatusChip
                            label={evt.status}
                            tokens={STATUS_TOKEN[evt.status] ?? NEUTRAL_TOKEN}
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
          </div>
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
