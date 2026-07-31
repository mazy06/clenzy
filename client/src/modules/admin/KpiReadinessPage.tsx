import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card as BuiCard } from '../../components/ui';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Grid, Card, CardActionArea, CardContent, Typography, Chip, Button, CircularProgress, Switch, FormControlLabel, Select, MenuItem, FormControl, InputLabel, Skeleton, Tooltip as MuiTooltip } from '@mui/material';
import {
  Refresh,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Shield,
  BarChart as BarChartIcon,
} from '../../icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import PageHeader from '../../components/PageHeader';
import { kpiApi, KpiSnapshot, KpiItem, KpiHistory, KpiStatus } from '../../services/api/kpiApi';
import { incidentApi, IncidentDto } from '../../services/api/incidentApi';
import IncidentDetailDialog from '../dashboard/IncidentDetailDialog';
import { formatDuration } from '../../utils/durationUtils';
import {
  useChartTokens,
  axisTick,
  renderChartLegendText,
} from '../reports/chartTheme';

// ─── Constants ───────────────────────────────────────────────────────────────

// Statuts KPI → tokens sémantiques Signature (texte couleur + fond -soft)
const STATUS_TOKEN: Record<KpiStatus, { fg: string; bg: string }> = {
  OK: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  WARNING: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  CRITICAL: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

const formatTimestamp = (ts: string): string => {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
};

const KPI_TOOLTIPS: Record<string, string> = {
  UPTIME: 'Disponibilite du serveur backend. Mesure le pourcentage de temps ou le service repond correctement aux health checks.',
  CALENDAR_LATENCY_P95: 'Temps de propagation des modifications de calendrier vers les channels (Airbnb, iCal). Le P95 represente le temps maximum pour 95% des synchronisations.',
  SYNC_ERROR_RATE: 'Pourcentage de synchronisations de calendrier echouees par rapport au total. Un taux eleve indique des problemes de connexion avec les channels.',
  INVENTORY_COHERENCE: 'Coherence entre les disponibilites affichees sur les channels et le calendrier interne Baitly. 100% = parfaitement synchronise.',
  DOUBLE_BOOKINGS: 'Nombre de doubles reservations detectees sur la periode. Un double booking signifie que deux reservations se chevauchent sur le meme logement.',
  API_LATENCY_P95: 'Temps de reponse du backend API. Le P95 represente le temps maximum pour 95% des requetes. Inclut tous les endpoints REST.',
  SYNC_AVAILABILITY: 'Disponibilite du service de synchronisation des calendriers. Mesure si le systeme de sync iCal/Airbnb est operationnel.',
  P1_RESOLUTION: 'Temps moyen de resolution des incidents priorite P1 (pannes critiques : SMTP, Kafka, base de donnees). Cliquez pour voir le detail des incidents recents.',
  KAFKA_LAG: 'Retard des consommateurs Kafka. Un lag eleve signifie que les messages (notifications, sync, emails) s\'accumulent sans etre traites.',
  OUTBOX_DRAIN: 'Temps pour vider la table outbox. L\'outbox stocke les evenements a envoyer vers Kafka. Un drain lent ralentit les notifications et syncs.',
  RECON_DIVERGENCE: 'Ecart entre les donnees internes et celles des channels apres reconciliation. 0% = aucune divergence detectee.',
  TEST_COVERAGE: 'Pourcentage de couverture des tests automatises sur le code backend. Mesure la proportion de code couverte par au moins un test.',
};

// ─── Score Gauge ─────────────────────────────────────────────────────────────

interface ScoreGaugeProps {
  score: number;
  criticalFailed: boolean;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, criticalFailed }) => {
  // Couleur du score → tokens sémantiques (réactifs thème/accent)
  const color = criticalFailed ? 'var(--err)'
    : score >= 80 ? 'var(--ok)'
    : score >= 50 ? 'var(--warn)'
    : 'var(--err)';

  return (
    <Card sx={{ textAlign: 'center', py: 3 }}>
      <CardContent>
        <div className="relative inline-flex">
          <CircularProgress
            variant="determinate"
            value={100}
            size={160}
            thickness={4}
            sx={{ color: 'var(--line)', position: 'absolute' }}
          />
          <CircularProgress
            variant="determinate"
            value={Math.min(score, 100)}
            size={160}
            thickness={4}
            sx={{ color }}
          />
          <div className="top-[0px] start-[0px] bottom-[0px] end-[0px] absolute flex flex-col items-center justify-center">
            <Box component="span" sx={{ display: 'inline-flex', color, mb: 0.5 }}>
              {criticalFailed ? (
                <Warning size={32} strokeWidth={1.75} />
              ) : (
                <Shield size={32} strokeWidth={1.75} />
              )}
            </Box>
            <Typography
              variant="h3"
              sx={{ fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}
            >
              {criticalFailed ? '0' : Math.round(score)}
            </Typography>
            <span className="cn-text-caption text-[var(--muted)]">/ 100</span>
          </div>
        </div>
        <h6 className="cn-text-h6 mt-3 font-semibold text-[var(--ink)]">
          Readiness Score
        </h6>
        {criticalFailed && (
          <Badge variant="secondary" className="mt-1.5 text-[var(--err)] bg-[var(--err-soft)]">KPI CRITIQUE EN ECHEC</Badge>
        )}
      </CardContent>
    </Card>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  kpi: KpiItem;
  onClick?: () => void;
  badgeCount?: number;
  tooltipContent?: string;
}

/**
 * Pour les KPI exprimes en minutes (ex: P1 Incident Resolution, API latency),
 * le backend renvoie une valeur formatee "14944 min" — peu lisible des qu'on
 * depasse l'heure. On reformate localement via {@link formatDuration} :
 * "14944 min" → "10j 9h", "190 min" → "3h 10min", etc.
 *
 * Pour les autres unites (%, count, ms, etc.), on garde le format backend.
 */
function formatKpiValue(rawValue: number, unit: string, fallback: string): string {
  if (unit === 'min') return formatDuration(rawValue);
  return fallback;
}

const KpiCard: React.FC<KpiCardProps> = ({ kpi, onClick, badgeCount, tooltipContent }) => {
  const tk = STATUS_TOKEN[kpi.status];

  const StatusIcon = kpi.status === 'OK' ? CheckCircle
    : kpi.status === 'WARNING' ? Warning : ErrorIcon;

  const displayedValue = formatKpiValue(kpi.rawValue, kpi.unit, kpi.value);
  const displayedTarget = kpi.unit === 'min'
    ? `< ${formatDuration(kpi.targetValue)}`
    : kpi.target;

  const cardContent = (
    <CardContent sx={{ pb: '12px !important' }}>
      <div className="flex justify-between items-start mb-1.5 gap-0.5">
        {/* Label en overline (pattern entête de tuile KPI) */}
        <p className="cn-text-body1 text-[10.5px] font-bold tracking-[.05em] uppercase text-[var(--faint)]">
          {kpi.name}
        </p>
        <div className="flex gap-0.5 shrink-0">
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge variant="secondary" className="text-[var(--err)] bg-[var(--err-soft)]">{`${badgeCount} ouvert${badgeCount > 1 ? 's' : ''}`}</Badge>
          )}
          {kpi.critical && (
            <Badge variant="secondary" className="text-[var(--err)] bg-[var(--err-soft)]">Critical</Badge>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        {/* Valeur display tabular-nums — l'accent statut vit dans la valeur + le chip */}
        <Typography
          variant="h4"
          sx={{ fontWeight: 600, color: tk.fg, fontVariantNumeric: 'tabular-nums' }}
        >
          {displayedValue}
        </Typography>
      </div>

      <div className="flex justify-between items-center">
        <span className="cn-text-caption text-[var(--muted)]">
          Target: {displayedTarget}
        </span>
        <Chip
          icon={<StatusIcon size={13} strokeWidth={1.75} />}
          label={kpi.status}
          size="small"
          sx={{
            color: tk.fg,
            backgroundColor: tk.bg,
            '& .MuiChip-icon': { color: tk.fg, marginLeft: '6px' },
          }}
        />
      </div>
    </CardContent>
  );

  // Carte plate hairline (statut porté par valeur + chip, pas par la bordure)
  const card = (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        ...(onClick && {
          cursor: 'pointer',
          '&:hover': { borderColor: 'var(--line-2)', boxShadow: 'var(--shadow-card)' },
        }),
      }}
    >
      {onClick ? (
        <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
          {cardContent}
        </CardActionArea>
      ) : (
        cardContent
      )}
    </Card>
  );

  if (tooltipContent) {
    return (
      <MuiTooltip
        title={tooltipContent}
        arrow
        placement="top"
        slotProps={{
          tooltip: {
            sx: { maxWidth: 360, fontSize: '0.75rem', p: 1.5 },
          },
        }}
      >
        <div className="h-full">{card}</div>
      </MuiTooltip>
    );
  }

  return card;
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  // Pattern tooltip Signature : encre sur fond (--ink / --bg), r8
  return (
    <Box
      sx={{
        p: '6px 10px',
        borderRadius: '8px',
        backgroundColor: 'var(--ink)',
        color: 'var(--bg)',
      }}
    >
      {label && (
        <p className="cn-text-body1 font-bold mb-0.5 text-[11.5px]">
          {new Date(label).toLocaleString()}
        </p>
      )}
      {payload.map((entry) => (
        <p className="cn-text-body1 block text-[11.5px] font-semibold" key={entry.name}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </p>
      ))}
    </Box>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const KpiReadinessPage: React.FC = () => {
  const chartTokens = useChartTokens();
  const queryClient = useQueryClient();
  /** Erreur d'une action manuelle (refresh) — distincte de l'erreur du poll. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [historyHours, setHistoryHours] = useState(24);

  // Snapshot + historique via react-query : fetch immédiat au mount,
  // auto-refresh 30 s uniquement si le toggle est actif, pause automatique
  // quand l'onglet est caché (refetchIntervalInBackground=false par défaut) —
  // l'ancien setInterval brut tournait indéfiniment onglet caché.
  const kpiQueryKey = ['kpi', 'readiness', historyHours] as const;
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: kpiQueryKey,
    queryFn: async () => {
      const [snap, hist] = await Promise.all([
        kpiApi.getCurrentSnapshot(),
        kpiApi.getHistory(historyHours),
      ]);
      return { snapshot: snap, history: hist };
    },
    refetchInterval: autoRefresh ? 30_000 : false,
    refetchOnWindowFocus: false,
    // Changement de période : on garde les données affichées pendant le
    // re-fetch (comportement historique — pas de retour au skeleton).
    placeholderData: keepPreviousData,
  });
  const snapshot: KpiSnapshot | null = data?.snapshot ?? null;
  const history: KpiHistory | null = data?.history ?? null;
  const error = actionError
    ?? (queryError
      ? (queryError instanceof Error ? queryError.message : 'Erreur lors du chargement des KPIs')
      : null);

  // Incident detail dialog state
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  /** Compte des OPEN P1 (aligne avec le modal filtre par severity=P1). */
  const [openIncidentCount, setOpenIncidentCount] = useState(0);
  /**
   * Compte total OPEN toutes severites — sert a detecter les OPEN non-P1
   * qui seraient invisibles dans le modal et a afficher un avertissement.
   * Si > openIncidentCount → il y a des OPEN P2/P3.
   */
  const [totalOpenAllSeverities, setTotalOpenAllSeverities] = useState(0);

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      setActionError(null);
      const snap = await kpiApi.refreshSnapshot();
      // Refresh history too — puis on pousse le tout dans le cache react-query
      const hist = await kpiApi.getHistory(historyHours);
      queryClient.setQueryData(kpiQueryKey, { snapshot: snap, history: hist });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors du refresh');
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch open incident count on mount — P1 + breakdown total pour diagnostic
  useEffect(() => {
    incidentApi.getOpenCount({ severity: 'P1', includeBreakdown: true })
      .then((res) => {
        setOpenIncidentCount(res.count);
        setTotalOpenAllSeverities(res.totalAllSeverities ?? res.count);
      })
      .catch(() => {
        setOpenIncidentCount(0);
        setTotalOpenAllSeverities(0);
      });
  }, []);

  const handleOpenIncidentDialog = useCallback(async () => {
    setIncidentDialogOpen(true);
    setIncidentsLoading(true);
    try {
      const data = await incidentApi.getIncidents({ severity: 'P1', size: 50 });
      setIncidents(data);
    } catch {
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  /**
   * Rafraichissement complet apres une action incident (delete, retest).
   * Necessaire car la suppression d'un incident impacte 3 surfaces :
   *  - la liste affichee dans le modal,
   *  - le badge "X ouvert(s)" sur la carte KPI P1,
   *  - la moyenne 'P1 Incident Resolution' (recalcul cote backend via refreshSnapshot).
   */
  const handleIncidentChange = useCallback(async () => {
    try {
      const [incidentList, countRes, snap] = await Promise.all([
        incidentApi.getIncidents({ severity: 'P1', size: 50 }),
        incidentApi.getOpenCount({ severity: 'P1', includeBreakdown: true }),
        kpiApi.refreshSnapshot(),
      ]);
      setIncidents(incidentList);
      setOpenIncidentCount(countRes.count);
      setTotalOpenAllSeverities(countRes.totalAllSeverities ?? countRes.count);
      // Le snapshot vit dans le cache react-query : on remplace la partie
      // snapshot en conservant l'historique affiché.
      queryClient.setQueryData(
        ['kpi', 'readiness', historyHours] as const,
        (old: { snapshot: KpiSnapshot; history: KpiHistory } | undefined) =>
          old ? { ...old, snapshot: snap } : old,
      );
    } catch {
      // best-effort : on n'echoue pas si une partie du refresh rate
    }
  }, [queryClient, historyHours]);

  // Format history points for chart
  const chartData = history?.points.map((p) => ({
    ...p,
    time: new Date(p.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  })) || [];

  return (
    <div>
      <PageHeader
        title="KPI Readiness"
        subtitle="Indicateurs de performance pour la certification Airbnb Partner"
        iconBadge={<BarChartIcon />}
        backPath="/admin"
        showBackButton={false}
      />

      {error && <Alert variant="destructive" className="mt-3 mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {loading ? (
        // Skeletons à la silhouette de la page (gauge + panneau + grille KPI)
        <div className="mt-4">
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px' }} />
            </Grid>
            <Grid item xs={12} md={8}>
              <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px' }} />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                <Skeleton variant="rounded" height={120} sx={{ borderRadius: '14px' }} />
              </Grid>
            ))}
          </Grid>
        </div>
      ) : snapshot ? (
        <>
          {/* Score + Controls */}
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <ScoreGauge score={snapshot.readinessScore} criticalFailed={snapshot.criticalFailed} />
            </Grid>
            <Grid item xs={12} md={8}>
              <BuiCard className="gap-0 py-0 p-4 h-full flex flex-col justify-center border-[var(--line)]">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <p className="cn-text-body1 text-[10.5px] font-bold tracking-[.05em] uppercase text-[var(--faint)]">
                      Derniere capture
                    </p>
                    <h6 className="cn-text-h6 font-semibold text-[var(--ink)]">
                      {formatTimestamp(snapshot.capturedAt)}
                    </h6>
                    <span className="cn-text-caption text-[var(--muted)]">
                      Source: {snapshot.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoRefresh}
                          onChange={(e) => setAutoRefresh(e.target.checked)}
                          size="small"
                        />
                      }
                      label="Auto-refresh"
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={refreshing ? <Spinner className="size-4" /> : <Refresh />}
                      onClick={handleManualRefresh}
                      disabled={refreshing}
                    >
                      Rafraichir
                    </Button>
                  </div>
                </div>

                {/* Summary chips — -soft : texte couleur + fond -soft */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {(['OK', 'WARNING', 'CRITICAL'] as KpiStatus[]).map((status) => {
                    const count = snapshot.kpis.filter((k) => k.status === status).length;
                    if (count === 0) return null;
                    const tk = STATUS_TOKEN[status];
                    return (
                      <Chip
                        key={status}
                        label={`${count} ${status}`}
                        size="small"
                        sx={{ color: tk.fg, backgroundColor: tk.bg }}
                      />
                    );
                  })}
                </div>
              </BuiCard>
            </Grid>
          </Grid>

          {/* 12 KPI Cards */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {snapshot.kpis.map((kpi) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={kpi.id}>
                <KpiCard
                  kpi={kpi}
                  onClick={kpi.id === 'P1_RESOLUTION' ? handleOpenIncidentDialog : undefined}
                  badgeCount={kpi.id === 'P1_RESOLUTION' ? openIncidentCount : undefined}
                  tooltipContent={KPI_TOOLTIPS[kpi.id]}
                />
              </Grid>
            ))}
          </Grid>

          {/* Historical Trend Chart */}
          <BuiCard className="gap-0 py-0 mt-4 p-4 border-[var(--line)]">
            <div className="flex justify-between items-center mb-3">
              <h6 className="cn-text-h6 font-semibold text-[var(--ink)]">
                Tendance historique
              </h6>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Periode</InputLabel>
                <Select
                  value={historyHours}
                  label="Periode"
                  onChange={(e) => setHistoryHours(Number(e.target.value))}
                >
                  <MenuItem value={24}>24 heures</MenuItem>
                  <MenuItem value={168}>7 jours</MenuItem>
                  <MenuItem value={720}>30 jours</MenuItem>
                </Select>
              </FormControl>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.line} />
                  <XAxis dataKey="time" tick={axisTick(chartTokens)} stroke={chartTokens.line} />
                  <YAxis domain={[0, 100]} tick={axisTick(chartTokens)} stroke={chartTokens.line} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} formatter={renderChartLegendText} />
                  <Line
                    type="monotone"
                    dataKey="readinessScore"
                    name="Readiness Score"
                    stroke={chartTokens.accent}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uptimePct"
                    name="Uptime %"
                    stroke={chartTokens.ok}
                    strokeWidth={1}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="inventoryCoherencePct"
                    name="Inventory %"
                    stroke={chartTokens.warn}
                    strokeWidth={1}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-9">
                <p className="cn-text-body1 text-muted-foreground">
                  Aucune donnee historique disponible.
                </p>
                <p className="cn-text-body2 text-muted-foreground opacity-60 mt-1.5">
                  Les snapshots sont captures automatiquement toutes les heures.
                </p>
              </div>
            )}
          </BuiCard>
        </>
      ) : null}

      {/* Incident Detail Dialog */}
      <IncidentDetailDialog
        open={incidentDialogOpen}
        onClose={() => setIncidentDialogOpen(false)}
        incidents={incidents}
        loading={incidentsLoading}
        onRefresh={handleIncidentChange}
        otherSeveritiesOpenCount={Math.max(0, totalOpenAllSeverities - openIncidentCount)}
        targetMinutes={
          snapshot?.kpis.find((k) => k.id === 'P1_RESOLUTION')?.targetValue ?? 60
        }
      />
    </div>
  );
};

export default KpiReadinessPage;
