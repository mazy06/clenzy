import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip as MuiTooltip,
} from '@mui/material';
import {
  Refresh,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Shield,
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

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<KpiStatus, string> = {
  OK: '#4caf50',
  WARNING: '#ff9800',
  CRITICAL: '#f44336',
};

const STATUS_BG_COLORS: Record<KpiStatus, string> = {
  OK: '#e8f5e9',
  WARNING: '#fff3e0',
  CRITICAL: '#ffebee',
};

const KPI_TOOLTIPS: Record<string, string> = {
  UPTIME: 'Disponibilite du serveur backend. Mesure le pourcentage de temps ou le service repond correctement aux health checks.',
  CALENDAR_LATENCY_P95: 'Temps de propagation des modifications de calendrier vers les channels (Airbnb, iCal). Le P95 represente le temps maximum pour 95% des synchronisations.',
  SYNC_ERROR_RATE: 'Pourcentage de synchronisations de calendrier echouees par rapport au total. Un taux eleve indique des problemes de connexion avec les channels.',
  INVENTORY_COHERENCE: 'Coherence entre les disponibilites affichees sur les channels et le calendrier interne Clenzy. 100% = parfaitement synchronise.',
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
  const color = criticalFailed ? '#f44336'
    : score >= 80 ? '#4caf50'
    : score >= 50 ? '#ff9800'
    : '#f44336';

  return (
    <Card sx={{ textAlign: 'center', py: 3 }}>
      <CardContent>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={160}
            thickness={4}
            sx={{ color: '#e0e0e0', position: 'absolute' }}
          />
          <CircularProgress
            variant="determinate"
            value={Math.min(score, 100)}
            size={160}
            thickness={4}
            sx={{ color }}
          />
          <Box
            sx={{
              top: 0, left: 0, bottom: 0, right: 0,
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {criticalFailed ? (
              <Box component="span" sx={{ display: 'inline-flex', mb: 0.5 }}><Warning size={32} strokeWidth={1.75} color='#f44336' /></Box>
            ) : (
              <Box component="span" sx={{ display: 'inline-flex', color, mb: 0.5 }}>
                <Shield size={32} strokeWidth={1.75} />
              </Box>
            )}
            <Typography variant="h3" sx={{ fontWeight: 700, color }}>
              {criticalFailed ? '0' : Math.round(score)}
            </Typography>
            <Typography variant="caption" color="text.secondary">/ 100</Typography>
          </Box>
        </Box>
        <Typography variant="h6" sx={{ mt: 2, fontWeight: 600 }}>
          Readiness Score
        </Typography>
        {criticalFailed && (
          <Chip
            label="KPI CRITIQUE EN ECHEC"
            color="error"
            size="small"
            sx={{ mt: 1 }}
          />
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

const KpiCard: React.FC<KpiCardProps> = ({ kpi, onClick, badgeCount, tooltipContent }) => {
  const chipColor = kpi.status === 'OK' ? 'success'
    : kpi.status === 'WARNING' ? 'warning' : 'error';

  const StatusIcon = kpi.status === 'OK' ? CheckCircle
    : kpi.status === 'WARNING' ? Warning : ErrorIcon;

  const cardContent = (
    <CardContent sx={{ pb: '12px !important' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
          {kpi.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {badgeCount !== undefined && badgeCount > 0 && (
            <Chip
              label={`${badgeCount} ouvert${badgeCount > 1 ? 's' : ''}`}
              size="small"
              color="error"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
          {kpi.critical && (
            <Chip label="Critical" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: STATUS_COLORS[kpi.status] }}>
          {kpi.value}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Target: {kpi.target}
        </Typography>
        <Chip
          icon={<StatusIcon size={14} strokeWidth={1.75} />}
          label={kpi.status}
          color={chipColor}
          size="small"
          sx={{ height: 22, fontSize: '0.7rem' }}
        />
      </Box>
    </CardContent>
  );

  const card = (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderColor: STATUS_COLORS[kpi.status],
        borderWidth: kpi.critical && kpi.status === 'CRITICAL' ? 2 : 1,
        backgroundColor: STATUS_BG_COLORS[kpi.status] + '40',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 3 },
        ...(onClick && { cursor: 'pointer' }),
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
        <Box sx={{ height: '100%' }}>{card}</Box>
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
  return (
    <Paper sx={{ p: 1.5, boxShadow: 3 }}>
      {label && (
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.8rem' }}>
          {new Date(label).toLocaleString()}
        </Typography>
      )}
      {payload.map((entry, index) => (
        <Typography
          key={index}
          variant="caption"
          sx={{ display: 'block', color: entry.color, fontSize: '0.75rem' }}
        >
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </Typography>
      ))}
    </Paper>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const KpiReadinessPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<KpiSnapshot | null>(null);
  const [history, setHistory] = useState<KpiHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [historyHours, setHistoryHours] = useState(24);

  // Incident detail dialog state
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [openIncidentCount, setOpenIncidentCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [snap, hist] = await Promise.all([
        kpiApi.getCurrentSnapshot(),
        kpiApi.getHistory(historyHours),
      ]);
      setSnapshot(snap);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des KPIs');
    } finally {
      setLoading(false);
    }
  }, [historyHours]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      const snap = await kpiApi.refreshSnapshot();
      setSnapshot(snap);
      // Refresh history too
      const hist = await kpiApi.getHistory(historyHours);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du refresh');
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch open incident count on mount
  useEffect(() => {
    incidentApi.getOpenCount()
      .then(setOpenIncidentCount)
      .catch(() => setOpenIncidentCount(0));
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

  const formatTimestamp = (ts: string): string => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  // Format history points for chart
  const chartData = history?.points.map((p) => ({
    ...p,
    time: new Date(p.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  })) || [];

  return (
    <Box>
      <PageHeader
        title="KPI Readiness"
        subtitle="Indicateurs de performance pour la certification Airbnb Partner"
        backPath="/admin"
        showBackButton={false}
      />

      {error && <Alert severity="error" sx={{ mt: 2, mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={6}>
          <CircularProgress />
        </Box>
      ) : snapshot ? (
        <>
          {/* Score + Controls */}
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <ScoreGauge score={snapshot.readinessScore} criticalFailed={snapshot.criticalFailed} />
            </Grid>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Derniere capture
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {formatTimestamp(snapshot.capturedAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Source: {snapshot.source}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                      startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
                      onClick={handleManualRefresh}
                      disabled={refreshing}
                    >
                      Rafraichir
                    </Button>
                  </Box>
                </Box>

                {/* Summary chips */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  {(['OK', 'WARNING', 'CRITICAL'] as KpiStatus[]).map((status) => {
                    const count = snapshot.kpis.filter((k) => k.status === status).length;
                    if (count === 0) return null;
                    const color = status === 'OK' ? 'success' : status === 'WARNING' ? 'warning' : 'error';
                    return (
                      <Chip
                        key={status}
                        label={`${count} ${status}`}
                        color={color}
                        size="small"
                        variant="outlined"
                      />
                    );
                  })}
                </Box>
              </Paper>
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
          <Paper sx={{ mt: 3, p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Tendance historique
              </Typography>
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
            </Box>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                  <Line
                    type="monotone"
                    dataKey="readinessScore"
                    name="Readiness Score"
                    stroke="#2196f3"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uptimePct"
                    name="Uptime %"
                    stroke="#4caf50"
                    strokeWidth={1}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="inventoryCoherencePct"
                    name="Inventory %"
                    stroke="#ff9800"
                    strokeWidth={1}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="body1" color="text.secondary">
                  Aucune donnee historique disponible.
                </Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                  Les snapshots sont captures automatiquement toutes les heures.
                </Typography>
              </Box>
            )}
          </Paper>
        </>
      ) : null}

      {/* Incident Detail Dialog */}
      <IncidentDetailDialog
        open={incidentDialogOpen}
        onClose={() => setIncidentDialogOpen(false)}
        incidents={incidents}
        loading={incidentsLoading}
        onRefresh={handleOpenIncidentDialog}
      />
    </Box>
  );
};

export default KpiReadinessPage;
