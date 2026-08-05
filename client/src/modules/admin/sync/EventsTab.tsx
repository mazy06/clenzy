import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Skeleton, Card, CardContent } from '../../../components/ui';
import { Field, FieldLabel, Input } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Timeline } from '../../../icons';
import { syncAdminApi, SyncLog, SyncEventStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import StatTile from '../../../components/baitly/StatTile';
import { useSyncAdminHeader } from '../SyncAdminPage';
import PagePagination from '../../../components/PagePagination';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';

type ChannelOption = 'AIRBNB' | 'BOOKING' | 'VRBO' | 'ICAL' | 'OTHER';

// Couleurs de canaux : tokens de marque --airbnb/--booking, hors palette sémantique
// (ils ne se migrent pas). `--accent` est la teinte CHOISIE par l'utilisateur.
// FilterChipRow en fait un color-mix à l'exécution → valeur CSS, pas utility.
const CHANNEL_OPTIONS: { value: ChannelOption; label: string; color: string }[] = [
  { value: 'AIRBNB',  label: 'Airbnb',  color: 'var(--airbnb)' },
  { value: 'BOOKING', label: 'Booking', color: 'var(--booking)' },
  { value: 'VRBO',    label: 'Vrbo',    color: '#1E88E5' },
  { value: 'ICAL',    label: 'iCal',    color: 'var(--bui-primary)' },
  { value: 'OTHER',   label: 'Autre',   color: 'var(--bui-muted-foreground)' },
];

// Sens de l'échange / issue de l'appel → ton sémantique. Le couple encre/fond
// conforme AA est tenu par StatusChip (STATUS_TONES).
const DIRECTION_TONE: Record<string, StatusTone> = {
  INBOUND: 'info',
  OUTBOUND: 'warn',
};

const STATUS_TONE: Record<string, StatusTone> = {
  SUCCESS: 'ok',
  ERROR: 'err',
  FAILED: 'err',
  PENDING: 'warn',
};

/** Label overline d'entête de carte — échelle Baitly UI. */
const OVERLINE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground';

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
      {/* Stats — StatTile pour la valeur unique, Card pour les deux ventilations */}
      {stats && (
        <div className="grid grid-cols-12 gap-3 mb-[18px]">
          <div className="col-span-12 min-[600px]:col-span-4">
            <StatTile icon={<Timeline />} label="Total (24h)" value={stats.totalLast24h} />
          </div>
          <div className="col-span-12 min-[600px]:col-span-4">
            <Card>
              <CardContent>
                <p className={cn(OVERLINE_CLASS, 'mb-[3px]')}>Par Channel</p>
                {Object.entries(stats.byChannel).map(([ch, count]) => (
                  <p className="text-xs tabular-nums" key={ch}>
                    {ch}: {count}
                  </p>
                ))}
                {Object.keys(stats.byChannel).length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucune donnee</p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="col-span-12 min-[600px]:col-span-4">
            <Card>
              <CardContent>
                <p className={cn(OVERLINE_CLASS, 'mb-[3px]')}>Par Status</p>
                {Object.entries(stats.byStatus).map(([s, count]) => (
                  <p className="text-xs tabular-nums" key={s}>
                    {s}: {count}
                  </p>
                ))}
                {Object.keys(stats.byStatus).length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucune donnee</p>
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
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
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
                            tone={DIRECTION_TONE[evt.direction] ?? 'neutral'}
                          />
                        ) : '—'}
                      </TableCell>
                      <TableCell>{evt.eventType}</TableCell>
                      <TableCell>
                        {evt.status ? (
                          <StatusChip
                            label={evt.status}
                            tone={STATUS_TONE[evt.status] ?? 'neutral'}
                          />
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={evt.errorMessage || undefined}>
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
