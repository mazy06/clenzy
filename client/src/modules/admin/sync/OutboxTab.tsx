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
  Skeleton,
  Alert,
  Tooltip,
  Typography,
  Grid,
  TextField,
  TablePagination,
} from '@mui/material';
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
    <Box sx={{ p: 0.5, maxWidth: 300 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 0.5 }}>{help.title}</Typography>
      <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.4, mb: 0.5 }}>{help.what}</Typography>
      <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.4, fontStyle: 'italic', color: 'var(--bg)', opacity: 0.85 }}>
        → {help.todo}
      </Typography>
    </Box>
  );
};

/**
 * Small column-header helper: label + an info icon that opens a tooltip explaining
 * the column. Keeps the table header tidy while making the data self-explanatory.
 */
const HeaderHint: React.FC<{ label: string; hint: string }> = ({ label, hint }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
    <span>{label}</span>
    <Tooltip arrow title={hint}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          color: 'text.disabled',
          cursor: 'help',
          '&:hover': { color: 'text.secondary' },
        }}
      >
        <InfoOutlined size={13} strokeWidth={1.75} />
      </Box>
    </Tooltip>
  </Box>
);

type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';

const STATUS_OPTIONS: { value: OutboxStatus; label: string; color: string }[] = [
  { value: 'PENDING', label: 'Pending', color: 'var(--info)' },
  { value: 'SENT',    label: 'Sent',    color: 'var(--ok)' },
  { value: 'FAILED',  label: 'Failed',  color: 'var(--err)' },
];

// Statuts outbox → tokens sémantiques (chips -soft : texte couleur + fond -soft)
const STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  PENDING: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  SENT: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  FAILED: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
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
      </Box>,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, statusFilter, topic]);

  // Register actions (Select All Failed + Retry Selected) into the page header.
  useEffect(() => {
    setHeaderActions(
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {OUTBOX_HELP}
        <Tooltip
          arrow
          title="Coche toutes les lignes en statut FAILED sur la page courante. Utile pour relancer un lot d'événements après avoir corrigé la cause (topic créé, broker remonté, etc.)."
        >
          <span>
            <Button size="small" variant="outlined" onClick={handleSelectAllFailed}>
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
          <span>
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
          </span>
        </Tooltip>
      </Box>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, handleSelectAllFailed, handleRetry, retrying, selectedIds.size]);

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
      {/* Stats — StatTile (carte plate hairline, valeur display tabular-nums) */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Events qui attendent d'être publiés vers Kafka. Le relais les traite par paquets toutes les quelques secondes.">
              <Box>
                <StatTile icon={<HourglassEmpty />} label="Pending" value={stats.pending} color="#7BA3C2" />
              </Box>
            </Tooltip>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Events publiés avec succès dans Kafka. Aucune action requise.">
              <Box>
                <StatTile icon={<SendIcon />} label="Sent" value={stats.sent} color="#4A9B8E" />
              </Box>
            </Tooltip>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Events dont la publication Kafka a échoué. Sélectionnez-les + bouton Retry après avoir corrigé la cause (voir colonne Error).">
              <Box>
                <StatTile icon={<ErrorOutline />} label="Failed" value={stats.failed} color="#C97A7A" />
              </Box>
            </Tooltip>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Tooltip arrow title="Total cumulé d'events écrits dans l'outbox depuis sa création.">
              <Box>
                <StatTile icon={<InfoOutlined />} label="Total" value={stats.total} color="#6B8A9A" />
              </Box>
            </Tooltip>
          </Grid>
        </Grid>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {retryMessage && <Alert severity="info" sx={{ mb: 2 }}>{retryMessage}</Alert>}

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
                  <TableCell padding="checkbox">
                    <Tooltip arrow title="Une case n'apparaît que sur les lignes FAILED. Cochez puis cliquez 'Retry Selected'.">
                      <Box component="span" sx={{ display: 'inline-flex', cursor: 'help' }}>
                        <InfoOutlined size={14} strokeWidth={1.75} />
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <HeaderHint label="ID" hint="Identifiant interne de l'event dans la table outbox." />
                  </TableCell>
                  <TableCell>
                    <HeaderHint
                      label="Aggregate"
                      hint="Entité métier source. Format type#id. Ex: USER#42 = changement de profil utilisateur 42."
                    />
                  </TableCell>
                  <TableCell>
                    <HeaderHint
                      label="Event Type"
                      hint="Nature de la mutation. Ex: USER_PROFILE_UPDATED, RESERVATION_CREATED, CALENDAR_BOOKED."
                    />
                  </TableCell>
                  <TableCell>
                    <HeaderHint
                      label="Topic"
                      hint="Topic Kafka cible. Si un topic n'existe pas côté broker, les envois finissent en FAILED."
                    />
                  </TableCell>
                  <TableCell>
                    <HeaderHint
                      label="Status"
                      hint="PENDING = en file, SENT = publié OK, FAILED = échec. Survolez le chip pour le détail + action recommandée."
                    />
                  </TableCell>
                  <TableCell>
                    <HeaderHint
                      label="Retry"
                      hint="Nombre de tentatives déjà effectuées. Incrémenté à chaque échec du relais."
                    />
                  </TableCell>
                  <TableCell>
                    <HeaderHint
                      label="Error"
                      hint="Message d'erreur de la dernière tentative. Survolez la ligne pour voir le message complet."
                    />
                  </TableCell>
                  <TableCell>
                    <HeaderHint label="Created At" hint="Moment où l'event a été persisté dans l'outbox (= moment de la mutation métier)." />
                  </TableCell>
                  <TableCell>
                    <HeaderHint label="Sent At" hint="Moment où l'event a été publié avec succès dans Kafka. Vide tant qu'il n'est pas SENT." />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ color: 'var(--muted)', py: 3 }}>
                      Aucun event
                    </TableCell>
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
                        <Tooltip arrow placement="right" title={renderStatusTooltip(evt.status)}>
                          <Chip
                            label={evt.status}
                            size="small"
                            sx={(() => {
                              const tk = STATUS_TOKEN[evt.status] ?? NEUTRAL_TOKEN;
                              return { color: tk.fg, backgroundColor: tk.bg, cursor: 'help' };
                            })()}
                          />
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
                          <Box component="span" sx={{ cursor: 'help' }}>{evt.retryCount}</Box>
                        </Tooltip>
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
