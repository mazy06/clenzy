import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Button, Spinner } from '../../components/ui';
import { Card as BuiCard, CardContent } from '../../components/ui';
import {
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Switch,
  Tooltip as BuiTooltip,
  TooltipContent as BuiTooltipContent,
  TooltipTrigger as BuiTooltipTrigger,
} from '../../components/ui';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
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
import EmptyState from '../../components/EmptyState';
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

/**
 * Statuts KPI → tokens sémantiques Baitly UI. `fg` habille du TEXTE (valeur du
 * KPI, libellé de la puce) : c'est donc la variante `-ink`, la teinte vive
 * plafonnant à ~2,2:1 sur `bg-card` en clair. `bg` est le fond pastel `-soft`.
 *
 * Les valeurs restent des VALEURS CSS et non des utilities Tailwind : elles sont
 * résolues au rendu depuis le statut, et Tailwind n'émet ses classes qu'à la
 * compilation.
 */
const STATUS_TOKEN: Record<KpiStatus, { fg: string; bg: string }> = {
  OK: { fg: 'var(--bui-success-ink)', bg: 'var(--bui-success-soft)' },
  WARNING: { fg: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)' },
  CRITICAL: { fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
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

// Jauge circulaire : 160 px de diametre, anneau de 4 px (r = 80 - 4/2).
const GAUGE_SIZE = 160;
const GAUGE_STROKE = 4;
const GAUGE_RADIUS = GAUGE_SIZE / 2 - GAUGE_STROKE / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, criticalFailed }) => {
  // Famille sémantique du score. L'arc est un APLAT graphique → teinte vive ;
  // le nombre et l'icône sont du TEXTE → variante `-ink` (seule conforme AA).
  const family = criticalFailed ? 'destructive'
    : score >= 80 ? 'success'
    : score >= 50 ? 'warning'
    : 'destructive';
  const arcColor = `var(--bui-${family})`;
  const inkColor = `var(--bui-${family}-ink)`;

  const filled = Math.min(Math.max(score, 0), 100);

  return (
    <BuiCard className="text-center py-[18px]">
      <CardContent>
        <div className="relative inline-flex">
          {/* SVG plutot que le CircularProgress MUI : le kit n'a pas de jauge
              circulaire DETERMINEE (Progress est lineaire, Spinner indetermine),
              et deux cercles suffisent — piste + arc, demarrage a midi. */}
          <svg
            width={GAUGE_SIZE}
            height={GAUGE_SIZE}
            viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
            role="img"
            aria-label={`Score de readiness : ${criticalFailed ? 0 : Math.round(score)} sur 100`}
            className="-rotate-90"
          >
            <circle
              cx={GAUGE_SIZE / 2}
              cy={GAUGE_SIZE / 2}
              r={GAUGE_RADIUS}
              fill="none"
              stroke="var(--bui-border)"
              strokeWidth={GAUGE_STROKE}
            />
            <circle
              cx={GAUGE_SIZE / 2}
              cy={GAUGE_SIZE / 2}
              r={GAUGE_RADIUS}
              fill="none"
              stroke={arcColor}
              strokeWidth={GAUGE_STROKE}
              strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - filled / 100)}
              className="[transition:stroke-dashoffset_400ms_ease-out] motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* La teinte suit le score, calculee au rendu. */}
            <span className="mb-[3px] inline-flex" style={{ color: inkColor }}>
              {criticalFailed ? (
                <Warning size={32} strokeWidth={1.75} />
              ) : (
                <Shield size={32} strokeWidth={1.75} />
              )}
            </span>
            {/* Echelle d'affichage : base / lg / xl selon le palier. */}
            <p
              className="text-base min-[1200px]:text-lg min-[1536px]:text-xl font-semibold leading-tight tracking-tight tabular-nums"
              style={{ color: inkColor }}
            >
              {criticalFailed ? '0' : Math.round(score)}
            </p>
            <span className="text-xs text-muted-foreground tabular-nums">/ 100</span>
          </div>
        </div>
        <h6 className="mt-3 text-sm font-semibold text-foreground">
          Readiness Score
        </h6>
        {criticalFailed && (
          <Badge variant="secondary" className="mt-1.5 bg-destructive-soft text-destructive-ink">
            KPI CRITIQUE EN ECHEC
          </Badge>
        )}
      </CardContent>
    </BuiCard>
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
    <CardContent className="pb-3">
      <div className="flex justify-between items-start mb-1.5 gap-0.5">
        {/* Label en overline (pattern entête de tuile KPI) */}
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {kpi.name}
        </p>
        <div className="flex gap-0.5 shrink-0">
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge variant="secondary" className="bg-destructive-soft text-destructive-ink tabular-nums">{`${badgeCount} ouvert${badgeCount > 1 ? 's' : ''}`}</Badge>
          )}
          {kpi.critical && (
            <Badge variant="secondary" className="bg-destructive-soft text-destructive-ink">Critical</Badge>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        {/* Valeur display tabular-nums — l'accent statut vit dans la valeur + le chip */}
        <h4 className="text-base font-semibold tracking-tight tabular-nums" style={{ color: tk.fg }}>
          {displayedValue}
        </h4>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          Target: {displayedTarget}
        </span>
        <StatusChip tokens={{ color: tk.fg, bg: tk.bg }} label={kpi.status} icon={<StatusIcon size={13} strokeWidth={1.75} />} />
      </div>
    </CardContent>
  );

  // Carte plate hairline (statut porté par valeur + chip, pas par la bordure)
  const card = (
    <BuiCard
      className={cn(
        'h-full',
        onClick && 'cursor-pointer transition-shadow duration-150 hover:shadow-sm',
      )}
    >
      {onClick ? (
        // Remplace CardActionArea : bouton nu qui couvre la carte, sans gabarit
        // de bouton (le style vit deja sur la carte).
        <button
          type="button"
          onClick={onClick}
          className="h-full w-full cursor-pointer border-0 bg-transparent p-0 text-start"
        >
          {cardContent}
        </button>
      ) : (
        cardContent
      )}
    </BuiCard>
  );

  if (tooltipContent) {
    return (
      <BuiTooltip>
        <BuiTooltipTrigger asChild>
          <div className="h-full">{card}</div>
        </BuiTooltipTrigger>
        <BuiTooltipContent side="top" className="max-w-[360px] text-[0.75rem]">
          {tooltipContent}
        </BuiTooltipContent>
      </BuiTooltip>
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
  // Infobulle inversee : encre en fond, fond d'application en texte.
  // (L'ancienne classe `p-[6px 10px]` etait invalide — un arbitraire Tailwind ne
  // prend pas d'espace — donc sans effet ; remplacee par l'echelle du kit.)
  return (
    <div className="rounded-md bg-ink px-2.5 py-1.5 text-background shadow-sm">
      {label && (
        <p className="mb-0.5 text-xs font-bold tabular-nums">
          {new Date(label).toLocaleString()}
        </p>
      )}
      {payload.map((entry) => (
        <p className="block text-xs font-semibold tabular-nums" key={entry.name}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </p>
      ))}
    </div>
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
          <div className="grid grid-cols-12 gap-[18px]">
            <div className="col-span-12 min-[900px]:col-span-4">
              <Skeleton className="h-[260px] rounded-xl" />
            </div>
            <div className="col-span-12 min-[900px]:col-span-8">
              <Skeleton className="h-[260px] rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-12 gap-3 mt-[3px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4 min-[1200px]:col-span-3" key={i}>
                <Skeleton className="h-[120px] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : snapshot ? (
        <>
          {/* Score + Controls */}
          <div className="grid grid-cols-12 gap-[18px] mt-1.5">
            <div className="col-span-12 min-[900px]:col-span-4">
              <ScoreGauge score={snapshot.readinessScore} criticalFailed={snapshot.criticalFailed} />
            </div>
            <div className="col-span-12 min-[900px]:col-span-8">
              <BuiCard className="gap-0 py-0 p-4 h-full flex flex-col justify-center">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Derniere capture
                    </p>
                    <h6 className="text-sm font-semibold text-foreground tabular-nums">
                      {formatTimestamp(snapshot.capturedAt)}
                    </h6>
                    <span className="text-xs text-muted-foreground">
                      Source: {snapshot.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Field orientation="horizontal" className="w-auto gap-1.5">
                      <Switch
                        id="kpi-auto-refresh"
                        size="sm"
                        checked={autoRefresh}
                        onCheckedChange={setAutoRefresh}
                      />
                      <FieldLabel htmlFor="kpi-auto-refresh">Auto-refresh</FieldLabel>
                    </Field>
                    <Button size="sm" onClick={handleManualRefresh} disabled={refreshing}>
                      {refreshing ? <Spinner className="size-4" /> : <Refresh />}
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
                      <StatusChip tokens={{ color: tk.fg, bg: tk.bg }} label={`${count} ${status}`} key={status} />
                    );
                  })}
                </div>
              </BuiCard>
            </div>
          </div>

          {/* 12 KPI Cards */}
          <div className="grid grid-cols-12 gap-3 mt-3">
            {snapshot.kpis.map((kpi) => (
              <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4 min-[1200px]:col-span-3" key={kpi.id}>
                <KpiCard
                  kpi={kpi}
                  onClick={kpi.id === 'P1_RESOLUTION' ? handleOpenIncidentDialog : undefined}
                  badgeCount={kpi.id === 'P1_RESOLUTION' ? openIncidentCount : undefined}
                  tooltipContent={KPI_TOOLTIPS[kpi.id]}
                />
              </div>
            ))}
          </div>

          {/* Historical Trend Chart */}
          <BuiCard className="gap-0 py-0 mt-4 p-4">
            <div className="flex justify-between items-center mb-3">
              <h6 className="text-sm font-semibold text-foreground">
                Tendance historique
              </h6>
              {/* Filtre sans libelle visible (il jouxte le titre de la carte) :
                  l'aria-label reste la seule etiquette. */}
              <NativeSelect
                size="sm"
                className="min-w-[120px]"
                aria-label="Periode"
                value={historyHours}
                onChange={(e) => setHistoryHours(Number(e.target.value))}
              >
                <NativeSelectOption value={24}>24 heures</NativeSelectOption>
                <NativeSelectOption value={168}>7 jours</NativeSelectOption>
                <NativeSelectOption value={720}>30 jours</NativeSelectOption>
              </NativeSelect>
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
              // La carte porte deja sa bordure : variante transparente.
              <EmptyState
                icon={<BarChartIcon />}
                title="Aucune donnee historique disponible"
                description="Les snapshots sont captures automatiquement toutes les heures."
                variant="transparent"
              />
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
