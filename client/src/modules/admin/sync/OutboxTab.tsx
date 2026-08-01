import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner, Button } from '../../../components/ui';
import { Checkbox, Skeleton, Tooltip, Grid, TextField } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import StatusChip, { type ToneTokens } from '../../../components/StatusChip';
import {
  Replay,
  InfoOutlined,
  HourglassEmpty,
  Send as SendIcon,
  ErrorOutline,
} from '../../../icons';
import { syncAdminApi, OutboxEvent, OutboxStats } from '../../../services/api/syncAdminApi';
import FilterChipRow from '../../../components/FilterChipRow';
import HelpPopover from '../../../components/HelpPopover';
import StatTile from '../../../components/StatTile';
import { useSyncAdminHeader } from '../SyncAdminPage';
import PagePagination from '../../../components/PagePagination';

// Contenu d'aide contextuelle (statique) — porté par l'icône ⓘ dans le header
// SyncAdmin plutôt qu'un bandeau permanent qui mange de la hauteur.
const OUTBOX_HELP = (
  <HelpPopover
    label="Aide"
    title="Comment fonctionne l'Outbox ?"
    description={
      'Chaque mutation métier (réservation, profil utilisateur, calendrier...) écrit un event '
      + 'dans la table outbox dans la MÊME transaction que la donnée. Le relais Kafka lit ensuite ces events '
      + 'et les publie sur le topic correspondant. Garantie : at-least-once, pas de perte.'
    }
    steps={[
      {
        icon: <HourglassEmpty size={14} strokeWidth={1.75} />,
        title: 'PENDING — en attente',
        description: "L'event est en file. Le relais Kafka va le récupérer au prochain cycle (~quelques secondes).",
        accent: 'info',
      },
      {
        icon: <SendIcon size={14} strokeWidth={1.75} />,
        title: 'SENT — envoyé',
        description: "L'event a été publié dans Kafka. Les consumers downstream peuvent maintenant le traiter.",
        accent: 'success',
      },
      {
        icon: <ErrorOutline size={14} strokeWidth={1.75} />,
        title: 'FAILED — à investiguer',
        description: "L'envoi a échoué (topic manquant, broker indisponible, payload invalide). Voir la colonne Error, "
          + 'corriger la cause, puis cliquer "Retry Selected" pour remettre l\'event en file.',
        accent: 'error',
      },
    ]}
  />
);

// ─── Tooltip copy ────────────────────────────────────────────────────────────
// Centralised so the same explanation surfaces in the chip, the column header,
// the filter chip, and the stats card. Stops the copy from drifting between
// surfaces and keeps the page truthfully consistent.
const STATUS_HELP: Record<string, { title: string; what: string; todo: string }> = {
  PENDING: {
    title: 'En file',
    what: "L'event est persisté en base, le relais Kafka va le récupérer au prochain cycle (quelques secondes).",
    todo: 'Aucune action requise — la transition vers SENT ou FAILED est automatique.',
  },
  SENT: {
    title: 'Envoyé',
    what: "L'event a bien été publié sur le topic Kafka. Les consumers downstream peuvent maintenant le traiter.",
    todo: 'Aucune action — bon signal.',
  },
  FAILED: {
    title: 'Échec',
    what: "La publication Kafka a échoué (topic manquant, broker indisponible, payload invalide). La colonne ERROR donne le détail.",
    todo: 'Corriger la cause sous-jacente puis cliquer "Retry Selected" pour remettre l\'event en file.',
  },
};

const renderStatusTooltip = (status: string) => {
  const help = STATUS_HELP[status];
  if (!help) return status;
  return (
    <div className="p-0.5 max-w-[300px]">
      <p className="cn-text-body1 text-[0.75rem] font-bold mb-0.5">{help.title}</p>
      <p className="cn-text-body1 text-[0.6875rem] leading-[1.4] mb-0.5">{help.what}</p>
      <p className="cn-text-body1 text-[0.6875rem] leading-[1.4] italic text-[var(--bg)] opacity-85">
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
    <Tooltip arrow title={hint}>
      <span className="inline-flex text-[var(--faint)] cursor-help hover:text-[var(--muted)]">
        <InfoOutlined size={13} strokeWidth={1.75} />
      </span>
    </Tooltip>
  </div>
);

type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';

const STATUS_OPTIONS: { value: OutboxStatus; label: string; color: string }[] = [
  { value: 'PENDING', label: 'Pending', color: 'var(--info)' },
  { value: 'SENT',    label: 'Sent',    color: 'var(--ok)' },
  { value: 'FAILED',  label: 'Failed',  color: 'var(--err)' },
];

// Statuts outbox → tokens sémantiques (chips -soft : texte couleur + fond -soft)
const STATUS_TOKEN: Record<string, ToneTokens> = {
  PENDING: { color: 'var(--info)', bg: 'var(--info-soft)' },
  SENT: { color: 'var(--ok)', bg: 'var(--ok-soft)' },
  FAILED: { color: 'var(--err)', bg: 'var(--err-soft)' },
};

const NEUTRAL_TOKEN: ToneTokens = { color: 'var(--muted)', bg: 'var(--hover)' };

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
      setError(err instanceof Error ? err.message : 'Erreur lors du retry');
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
        <TextField
          size="small"
          label="Topic"
          value={topic}
          onChange={(e) => { setTopic(e.target.value); setPage(0); }}
          sx={{ width: 180 }}
        />
      </div>,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, statusFilter, topic]);

  // Register actions (Select All Failed + Retry Selected) into the page header.
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-1.5">
        {OUTBOX_HELP}
        <Tooltip
          arrow
          title="Coche toutes les lignes en statut FAILED sur la page courante. Utile pour relancer un lot d'événements après avoir corrigé la cause (topic créé, broker remonté, etc.)."
        >
          <span className="inline-flex">
            <Button size="sm" variant="outline" onClick={handleSelectAllFailed}>
              Select All Failed
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          arrow
          title={
            selectedIds.size === 0
              ? "Sélectionne au moins un event FAILED pour pouvoir le relancer."
              : "Remet les events sélectionnés en statut PENDING. Le relais Kafka va retenter l'envoi au prochain cycle (~4 s)."
          }
        >
          <span className="inline-flex">
            {/* Teinte warn posee en classes : le kit n'a pas de variante « warning ». */}
            <Button
              size="sm"
              variant="outline"
              className="text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
              onClick={handleRetry}
              disabled={selectedIds.size === 0 || retrying}
            >
              {retrying ? <Spinner className="size-4" /> : <Replay />}
              Retry Selected ({selectedIds.size})
            </Button>
          </span>
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
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Events qui attendent d'être publiés vers Kafka. Le relais les traite par paquets toutes les quelques secondes.">
              <div>
                <StatTile icon={<HourglassEmpty />} label="Pending" value={stats.pending} color="#7BA3C2" />
              </div>
            </Tooltip>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Events publiés avec succès dans Kafka. Aucune action requise.">
              <div>
                <StatTile icon={<SendIcon />} label="Sent" value={stats.sent} color="#4A9B8E" />
              </div>
            </Tooltip>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Events dont la publication Kafka a échoué. Sélectionnez-les + bouton Retry après avoir corrigé la cause (voir colonne Error).">
              <div>
                <StatTile icon={<ErrorOutline />} label="Failed" value={stats.failed} color="#C97A7A" />
              </div>
            </Tooltip>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Total cumulé d'events écrits dans l'outbox depuis sa création.">
              <div>
                <StatTile icon={<InfoOutlined />} label="Total" value={stats.total} color="#6B8A9A" />
              </div>
            </Tooltip>
          </Grid>
        </Grid>
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
            <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Gabarit MuiTableCell padding="checkbox" : 48px de large, 0 0 0 4px. */}
                  <TableHead className="w-12 p-0 ps-1">
                    <Tooltip arrow title="Une case n'apparaît que sur les lignes FAILED. Cochez puis cliquez 'Retry Selected'.">
                      <span className="inline-flex cursor-help">
                        <InfoOutlined size={14} strokeWidth={1.75} />
                      </span>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <HeaderHint label="ID" hint="Identifiant interne de l'event dans la table outbox." />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Aggregate"
                      hint="Entité métier source. Format type#id. Ex: USER#42 = changement de profil utilisateur 42."
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Event Type"
                      hint="Nature de la mutation. Ex: USER_PROFILE_UPDATED, RESERVATION_CREATED, CALENDAR_BOOKED."
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Topic"
                      hint="Topic Kafka cible. Si un topic n'existe pas côté broker, les envois finissent en FAILED."
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Status"
                      hint="PENDING = en file, SENT = publié OK, FAILED = échec. Survolez le chip pour le détail + action recommandée."
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Retry"
                      hint="Nombre de tentatives déjà effectuées. Incrémenté à chaque échec du relais."
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint
                      label="Error"
                      hint="Message d'erreur de la dernière tentative. Survolez la ligne pour voir le message complet."
                    />
                  </TableHead>
                  <TableHead>
                    <HeaderHint label="Created At" hint="Moment où l'event a été persisté dans l'outbox (= moment de la mutation métier)." />
                  </TableHead>
                  <TableHead>
                    <HeaderHint label="Sent At" hint="Moment où l'event a été publié avec succès dans Kafka. Vide tant qu'il n'est pas SENT." />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-[var(--muted)] py-[18px]">
                      Aucun event
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
                            onChange={() => handleToggleSelect(evt.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>{evt.id}</TableCell>
                      <TableCell>{evt.aggregateType}#{evt.aggregateId}</TableCell>
                      <TableCell>{evt.eventType}</TableCell>
                      <TableCell>{evt.topic}</TableCell>
                      <TableCell>
                        <Tooltip arrow placement="right" title={renderStatusTooltip(evt.status)}>
                          {/* Le span porte la ref que Tooltip pose sur son enfant :
                              StatusChip est une fonction et n'en transmet pas. */}
                          <span className="inline-flex">
                            <StatusChip
                              tokens={STATUS_TOKEN[evt.status] ?? NEUTRAL_TOKEN}
                              label={evt.status}
                              className="cursor-help"
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip
                          arrow
                          title={
                            evt.retryCount === 0
                              ? "Aucune tentative supplémentaire — c'est encore le premier essai."
                              : `${evt.retryCount} tentative(s) après échec(s) précédent(s).`
                          }
                        >
                          <span className="cursor-help">{evt.retryCount}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <p className="cn-text-body2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={evt.errorMessage || undefined}>
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
