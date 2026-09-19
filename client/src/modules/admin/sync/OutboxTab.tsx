import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner, Button } from '../../../components/ui';
import {
  Checkbox,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Field, FieldLabel, Input } from '../../../components/ui';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import {
  Replay,
  InfoOutlined,
  HourglassEmpty,
  Send as SendIcon,
  ErrorOutline,
} from '../../../icons';
import { syncAdminApi, OutboxEvent, OutboxStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import HelpPopover from '../../../components/HelpPopover';
import StatTile from '../../../components/baitly/StatTile';
import { useSyncAdminHeader } from '../SyncAdminPage';
import PagePagination from '../../../components/PagePagination';
import { useTranslation } from '../../../hooks/useTranslation';

// Contenu d'aide contextuelle (statique) — porté par l'icône ⓘ dans le header
// SyncAdmin plutôt qu'un bandeau permanent qui mange de la hauteur.
// Composant et non constante : la langue se lit au rendu, ce qu'une valeur
// figee au chargement du module ne saurait faire.
const OutboxHelp: React.FC = () => {
  const { t } = useTranslation();
  return (
    <HelpPopover
      label={t('common.help')}
      title={t('admin.outbox.help.title')}
      description={t('admin.outbox.help.description')}
      steps={[
        {
          icon: <HourglassEmpty size={14} strokeWidth={1.75} />,
          title: t('admin.outbox.help.pending.title'),
          description: t('admin.outbox.help.pending.description'),
          accent: 'info',
        },
        {
          icon: <SendIcon size={14} strokeWidth={1.75} />,
          title: t('admin.outbox.help.sent.title'),
          description: t('admin.outbox.help.sent.description'),
          accent: 'success',
        },
        {
          icon: <ErrorOutline size={14} strokeWidth={1.75} />,
          title: t('admin.outbox.help.failed.title'),
          description: t('admin.outbox.help.failed.description'),
          accent: 'error',
        },
      ]}
    />
  );
};

// ─── Tooltip copy ────────────────────────────────────────────────────────────
// Centralised so the same explanation surfaces in the chip, the column header,
// the filter chip, and the stats card. Stops the copy from drifting between
// surfaces and keeps the page truthfully consistent.
const STATUS_HELP_KEYS: Record<string, string> = {
  PENDING: 'admin.outbox.statusHelp.pending',
  SENT: 'admin.outbox.statusHelp.sent',
  FAILED: 'admin.outbox.statusHelp.failed',
};

const renderStatusTooltip = (status: string, t: (key: string) => string) => {
  const prefix = STATUS_HELP_KEYS[status];
  if (!prefix) return status;
  const help = { title: t(prefix + '.title'), what: t(prefix + '.what'), todo: t(prefix + '.todo') };
  return (
    <div className="p-0.5 max-w-[300px]">
      <p className="text-xs font-bold mb-0.5">{help.title}</p>
      <p className="text-[0.6875rem] leading-[1.4] mb-0.5">{help.what}</p>
      {/* L'encre du tooltip (text-background sur bg-foreground) est déjà héritée. */}
      <p className="text-[0.6875rem] leading-[1.4] italic opacity-85">
        → {help.todo}
      </p>
    </div>
  );
};

/**
 * Small column-header helper: label + an info icon that opens a tooltip explaining
 * the column. Keeps the table header tidy while making the data self-explanatory.
 */
const HeaderHint: React.FC<{ label: string; hint: string }> = ({ label, hint }) => (
  <div className="inline-flex items-center gap-0.5">
    <span>{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex text-faint cursor-help hover:text-muted-foreground">
          <InfoOutlined size={13} strokeWidth={1.75} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  </div>
);

type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';

// Teinte vive de chaque option : FilterChipRow la passe dans un color-mix évalué
// à l'exécution → valeur CSS `--bui-*`, une utility Tailwind ne serait pas générée.
const STATUS_OPTIONS: { value: OutboxStatus; label: string; color: string }[] = [
  { value: 'PENDING', label: 'Pending', color: 'var(--bui-info)' },
  { value: 'SENT',    label: 'Sent',    color: 'var(--bui-success)' },
  { value: 'FAILED',  label: 'Failed',  color: 'var(--bui-destructive)' },
];

// Statut outbox → ton sémantique. Le couple encre/fond conforme AA est tenu par
// StatusChip (STATUS_TONES) : ici on ne dit que le SENS, pas la couleur.
const STATUS_TONE: Record<string, StatusTone> = {
  PENDING: 'info',
  SENT: 'ok',
  FAILED: 'err',
};

const OutboxTab: React.FC = () => {
  const { t } = useTranslation();
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
  const [statusFilter, setStatusFilter] = useState<OutboxStatus | ''>('');
  const [topic, setTopic] = useState('');
  const { setHeaderFilters, setHeaderActions } = useSyncAdminHeader();

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
      setError(err instanceof Error ? err.message : t('admin.sync.outboxLoadError'));
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

  const handleSelectAllFailed = useCallback(() => {
    const failedIds = events.flatMap((e) => (e.status === 'FAILED' ? [e.id] : []));
    setSelectedIds(new Set(failedIds));
  }, [events]);

  const handleRetry = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      setRetrying(true);
      setRetryMessage(null);
      const result = await syncAdminApi.retryOutboxEvents(Array.from(selectedIds));
      // "retried" means the event was re-enqueued (status → PENDING). The actual Kafka
      // send happens on the next OutboxRelay tick — refresh shortly to see SENT/FAILED.
      setRetryMessage(
        `${result.retried}/${result.requested} event(s) relancés. Le statut se mettra à jour dans quelques secondes.`
        + (result.failedIds.length > 0 ? ` Échec de relance: ${result.failedIds.join(', ')}` : ''),
      );
      setSelectedIds(new Set());
      await fetchEvents();
      await fetchStats();
      // The OutboxRelay processes pending events every few seconds. Schedule a follow-up
      // refresh so SENT/FAILED transitions appear automatically without a manual reload.
      window.setTimeout(() => {
        fetchEvents();
        fetchStats();
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.sync.retryError'));
    } finally {
      setRetrying(false);
    }
  }, [selectedIds, fetchEvents]);

  // Register filters (Status + Topic) into the page header.
  useEffect(() => {
    setHeaderFilters(
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChipRow
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as OutboxStatus | ''); setPage(0); }}
          allLabel="Tous"
          size="compact"
        />
        <Field className="w-[180px]">
          <FieldLabel htmlFor="outbox-filter-topic">Topic</FieldLabel>
          <Input
            id="outbox-filter-topic"
            className="w-full"
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setPage(0); }}
          />
        </Field>
      </div>,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, statusFilter, topic]);

  // Register actions (Select All Failed + Retry Selected) into the page header.
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-1.5">
        <OutboxHelp />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button size="sm" variant="outline" onClick={handleSelectAllFailed}>
                Select All Failed
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t('admin.sync.selectAllFailed')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              {/* Teinte warn posee en classes : le kit n'a pas de variante « warning ».
                  Encre en `-ink` (AA), bordure et fond pastel sur la teinte vive. */}
              <Button
                size="sm"
                variant="outline"
                className="text-warning-ink border-warning hover:bg-warning-soft"
                onClick={handleRetry}
                disabled={selectedIds.size === 0 || retrying}
              >
                {retrying ? <Spinner className="size-4" /> : <Replay />}
                Retry Selected ({selectedIds.size})
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {selectedIds.size === 0
              ? t('admin.sync.selectFailedFirst')
              : "Remet les events sélectionnés en statut PENDING. Le relais Kafka va retenter l'envoi au prochain cycle (~4 s)."}
          </TooltipContent>
        </Tooltip>
      </div>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, handleSelectAllFailed, handleRetry, retrying, selectedIds.size]);

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
    setSelectedIds(new Set());
  };

  const handleChangeRowsPerPage = (rows: number) => {
    setRowsPerPage(rows);
    setPage(0);
    setSelectedIds(new Set());
  };

  return (
    <div>
      {/* Stats — StatTile (carte plate hairline, valeur display tabular-nums) */}
      {stats && (
        <div className="grid grid-cols-12 gap-3 mb-[18px]">
          <div className="col-span-6 min-[600px]:col-span-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <StatTile icon={<HourglassEmpty />} label="Pending" value={stats.pending} iconClassName="text-info" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {t('admin.sync.pendingHint')}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="col-span-6 min-[600px]:col-span-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <StatTile icon={<SendIcon />} label="Sent" value={stats.sent} iconClassName="text-success" />
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('admin.sync.publishedHint')}</TooltipContent>
            </Tooltip>
          </div>
          <div className="col-span-6 min-[600px]:col-span-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <StatTile icon={<ErrorOutline />} label="Failed" value={stats.failed} iconClassName="text-destructive" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {t('admin.sync.failedHint')}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="col-span-6 min-[600px]:col-span-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <StatTile icon={<InfoOutlined />} label="Total" value={stats.total} iconClassName="text-primary" />
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('admin.sync.totalHint')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {error && <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}
      {retryMessage && <Alert variant="info" className="mb-3">
        <Info />
        <AlertDescription>{retryMessage}</AlertDescription>
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
                  {/* Gabarit MuiTableCell padding="checkbox" : 48px de large, 0 0 0 4px. */}
                  <TableHead className="w-12 p-0 ps-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help">
                          <InfoOutlined size={14} strokeWidth={1.75} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('admin.sync.checkboxHint')}
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <HeaderHint label="ID" hint={t('admin.outbox.columns.id')} />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Aggregate"
                      hint={t('admin.outbox.columns.aggregate')}
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Event Type"
                      hint={t('admin.outbox.columns.eventType')}
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Topic"
                      hint={t('admin.outbox.columns.topic')}
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Status"
                      hint={t('admin.outbox.columns.status')}
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Retry"
                      hint={t('admin.outbox.columns.retry')}
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Error"
                      hint={t('admin.outbox.columns.error')}
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint label="Created At" hint={t('admin.outbox.columns.createdAt')} />
                  </TableHead>
                  <TableHead>
                    <HeaderHint label="Sent At" hint={t('admin.outbox.columns.sentAt')} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-[18px]">
                      {t('admin.sync.noEvent')}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((evt) => (
                    // data-state=selected est le pendant kit de la prop `selected` de MuiTableRow.
                    <TableRow key={evt.id} data-state={selectedIds.has(evt.id) ? 'selected' : undefined}>
                      <TableCell className="w-12 p-0 ps-1">
                        {evt.status === 'FAILED' && (
                          <Checkbox
                            checked={selectedIds.has(evt.id)}
                            onCheckedChange={() => handleToggleSelect(evt.id)}
                            aria-label={`Sélectionner l'event ${evt.id}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>{evt.id}</TableCell>
                      <TableCell>{evt.aggregateType}#{evt.aggregateId}</TableCell>
                      <TableCell>{evt.eventType}</TableCell>
                      <TableCell>{evt.topic}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* Le span porte la ref que TooltipTrigger pose sur son enfant :
                                StatusChip est une fonction et n'en transmet pas. */}
                            <span className="inline-flex">
                              <StatusChip
                                tone={STATUS_TONE[evt.status] ?? 'neutral'}
                                label={evt.status}
                                className="cursor-help"
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right">{renderStatusTooltip(evt.status, t)}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{evt.retryCount}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {evt.retryCount === 0
                              ? "Aucune tentative supplémentaire — c'est encore le premier essai."
                              : `${evt.retryCount} tentative(s) après échec(s) précédent(s).`}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={evt.errorMessage || undefined}>
                          {evt.errorMessage || '—'}
                        </p>
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

export default OutboxTab;
