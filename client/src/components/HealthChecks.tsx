import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  HealthAndSafety,
  Refresh,
  ExpandMore,
  ExpandLess,
  Wifi,
  Speed,
  Security,
  Storage as StorageIcon,
  Memory,
} from '../icons';
import { monitoringApi } from '../services/api/monitoringApi';
import type { HealthCheckService, SystemMetrics } from '../services/api/monitoringApi';
import StatTile from './StatTile';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';

/** Chip -soft : texte couleur + fond -soft (pilule/typo via theme global MuiChip) */
const chipSx = (fg: string, bg: string) => ({
  color: fg,
  backgroundColor: bg,
  '& .MuiChip-icon': { color: fg },
});

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

// Statut sante → tokens semantiques (UP --ok, DOWN --err, DEGRADED --warn)
const STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  UP: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  DOWN: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  DEGRADED: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
};

const statusToken = (status: string) => STATUS_TOKEN[status] ?? NEUTRAL_TOKEN;

// Equivalents hex de la palette validee (requis par l'API StatTile)
const STATUS_HEX: Record<string, string> = {
  UP: '#4A9B8E',
  DOWN: '#C97A7A',
  DEGRADED: '#D4A574',
};

const statusHex = (status: string) => STATUS_HEX[status] ?? '#7BA3C2';

const HealthChecks: React.FC = () => {
  const [healthChecks, setHealthChecks] = useState<HealthCheckService[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();

  const fetchHealthChecks = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await monitoringApi.getHealth();
      setHealthChecks(data.services);
      setSystemMetrics(data.systemMetrics);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erreur lors de la récupération des vérifications de santé');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthChecks();

    // Actualisation automatique toutes les 30 secondes
    const interval = setInterval(fetchHealthChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchHealthChecks();
  };

  // Register page-header actions + last-update timestamp.
  useEffect(() => {
    setHeaderActions(
      <Box display="flex" alignItems="center" gap={1}>
        {loading && <CircularProgress size={16} />}
        <Tooltip title="Actualiser les vérifications">
          <IconButton onClick={handleRefresh} size="small">
            <Refresh size={20} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </Box>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, loading]);

  useEffect(() => {
    setHeaderLastUpdate(lastUpdate);
  }, [setHeaderLastUpdate, lastUpdate]);

  const toggleExpanded = (checkName: string) => {
    const newExpanded = new Set(expandedChecks);
    if (newExpanded.has(checkName)) {
      newExpanded.delete(checkName);
    } else {
      newExpanded.add(checkName);
    }
    setExpandedChecks(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UP':
        return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)' }}><CheckCircle size={20} strokeWidth={1.75} /></Box>;
      case 'DOWN':
        return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--err)' }}><ErrorIcon size={20} strokeWidth={1.75} /></Box>;
      case 'DEGRADED':
        return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}><Warning size={20} strokeWidth={1.75} /></Box>;
      default:
        return <Box component="span" sx={{ display: 'inline-flex', color: 'var(--info)' }}><Info size={20} strokeWidth={1.75} /></Box>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'DATABASE':
        return <StorageIcon size={20} strokeWidth={1.75} />;
      case 'AUTHENTICATION':
        return <Security size={20} strokeWidth={1.75} />;
      case 'API':
        return <Speed size={20} strokeWidth={1.75} />;
      case 'CACHE':
        return <Memory size={20} strokeWidth={1.75} />;
      case 'STORAGE':
        return <StorageIcon size={20} strokeWidth={1.75} />;
      case 'NOTIFICATIONS':
        return <Info size={20} strokeWidth={1.75} />;
      case 'MONITORING':
        return <HealthAndSafety size={20} strokeWidth={1.75} />;
      case 'NETWORK':
        return <Wifi size={20} strokeWidth={1.75} />;
      default:
        return <Info size={20} strokeWidth={1.75} />;
    }
  };

  const responseTimeToken = (responseTime: number) => {
    if (responseTime <= 100) return STATUS_TOKEN.UP;
    if (responseTime <= 300) return STATUS_TOKEN.DEGRADED;
    return STATUS_TOKEN.DOWN;
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}j ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const overallStatus = healthChecks.length > 0 ?
    healthChecks.every(check => check.status === 'UP') ? 'UP' :
    healthChecks.some(check => check.status === 'DOWN') ? 'DOWN' : 'DEGRADED' : 'UNKNOWN';

  const criticalChecks = healthChecks.filter(check => check.critical);
  const criticalStatus = criticalChecks.length > 0 ?
    criticalChecks.every(check => check.status === 'UP') ? 'UP' :
    criticalChecks.some(check => check.status === 'DOWN') ? 'DOWN' : 'DEGRADED' : 'UNKNOWN';

  if (loading && healthChecks.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && healthChecks.length === 0) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={handleRefresh}>
          Réessayer
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Vue d'ensemble — StatTile (carte plate hairline, valeur display) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <StatTile
            icon={<HealthAndSafety />}
            label="Statut Global"
            value={overallStatus}
            color={statusHex(overallStatus)}
            hint={`${healthChecks.filter(check => check.status === 'UP').length} sur ${healthChecks.length} services opérationnels`}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatTile
            icon={<Security />}
            label="Services Critiques"
            value={criticalStatus}
            color={statusHex(criticalStatus)}
            hint={`${criticalChecks.filter(check => check.status === 'UP').length} sur ${criticalChecks.length} services critiques opérationnels`}
          />
        </Grid>
      </Grid>

      {/* Métriques système — valeurs display tabular-nums + barres tokens */}
      {systemMetrics && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: 'var(--ink)' }}>
              Métriques Système
            </Typography>
            <Grid container spacing={3}>
              {([
                { label: 'CPU', value: systemMetrics.cpuUsage, suffix: '%' },
                { label: `Mémoire (${systemMetrics.heapUsedMb}/${systemMetrics.heapMaxMb} MB)`, value: systemMetrics.memoryUsage, suffix: '%' },
                { label: 'Disque', value: systemMetrics.diskUsage, suffix: '%' },
              ] as const).map((metric) => {
                const barColor = metric.value > 80 ? 'var(--err)' : metric.value > 60 ? 'var(--warn)' : 'var(--accent)';
                return (
                  <Grid item xs={12} sm={6} md={2} key={metric.label}>
                    <Box textAlign="center">
                      <Typography
                        variant="h6"
                        sx={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}
                      >
                        {metric.value}{metric.suffix}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                        {metric.label}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(metric.value, 100)}
                        sx={{
                          mt: 1,
                          height: 4,
                          borderRadius: 2,
                          bgcolor: 'var(--hover)',
                          '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 2 },
                        }}
                      />
                    </Box>
                  </Grid>
                );
              })}
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', color: 'var(--ok)' }}
                  >
                    {formatUptime(systemMetrics.uptimeSeconds)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                    Uptime JVM
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Vérifications détaillées */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: 'var(--ink)' }}>
            Vérifications Détaillées ({healthChecks.length} services)
          </Typography>

          <List>
            {healthChecks.map((check, index) => (
              <React.Fragment key={check.name}>
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(check.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="subtitle1" component="span">
                          {check.name}
                        </Typography>
                        <Chip
                          label={check.status}
                          size="small"
                          sx={chipSx(statusToken(check.status).fg, statusToken(check.status).bg)}
                        />
                        <Chip
                          label={check.category}
                          size="small"
                          icon={getCategoryIcon(check.category)}
                          sx={chipSx(NEUTRAL_TOKEN.fg, NEUTRAL_TOKEN.bg)}
                        />
                        {check.critical && (
                          <Chip
                            label="CRITIQUE"
                            size="small"
                            sx={chipSx('var(--err)', 'var(--err-soft)')}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box mt={1}>
                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={1}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Temps de réponse:</strong>
                            <Chip
                              label={`${check.responseTimeMs}ms`}
                              size="small"
                              sx={{ ...chipSx(responseTimeToken(check.responseTimeMs).fg, responseTimeToken(check.responseTimeMs).bg), ml: 1, fontVariantNumeric: 'tabular-nums' }}
                            />
                          </Typography>
                          {check.lastCheck && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Dernière vérification:</strong> {new Date(check.lastCheck).toLocaleTimeString()}
                            </Typography>
                          )}
                        </Box>

                        <Collapse in={expandedChecks.has(check.name)}>
                          {/* Détails techniques : mono compact sur fond --field */}
                          <Box mt={1} px={1.5} py={1} sx={{ bgcolor: 'var(--field)', border: '1px solid var(--field-line)', borderRadius: '8px' }}>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--body)', wordBreak: 'break-word' }}>
                              {check.details}
                            </Typography>
                          </Box>
                        </Collapse>
                      </Box>
                    }
                  />
                  <IconButton
                    onClick={() => toggleExpanded(check.name)}
                    size="small"
                  >
                    {expandedChecks.has(check.name) ? <ExpandLess size={20} strokeWidth={1.75} /> : <ExpandMore size={20} strokeWidth={1.75} />}
                  </IconButton>
                </ListItem>
                {index < healthChecks.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default HealthChecks;
