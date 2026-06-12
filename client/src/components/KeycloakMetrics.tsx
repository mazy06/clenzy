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
} from '@mui/material';
import {
  TrendingUp,
  Refresh,
  Group,
  Security,
  Wifi,
  BugReport,
} from '../icons';
import { monitoringApi } from '../services/api/monitoringApi';
import type { KeycloakMetricsResponse, TestCoverageMetrics } from '../services/api/monitoringApi';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';

/** Chip -soft : texte couleur + fond -soft (pilule/typo via theme global MuiChip) */
const chipSx = (fg: string, bg: string) => ({
  color: fg,
  backgroundColor: bg,
  '& .MuiChip-icon': { color: fg },
});

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };
const INFO_TOKEN = { fg: 'var(--info)', bg: 'var(--info-soft)' };

// Niveau semantique → token couleur (texte des grosses valeurs + chips)
const SEM_TOKEN: Record<'success' | 'warning' | 'error', { fg: string; bg: string }> = {
  success: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  warning: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  error: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

/** Grosse valeur de carte : display + tabular-nums (pattern StatTile) */
const displayValueSx = (color: string) => ({
  fontFamily: 'var(--font-display)',
  fontVariantNumeric: 'tabular-nums',
  color,
});

const KeycloakMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<KeycloakMetricsResponse | null>(null);
  const [coverage, setCoverage] = useState<TestCoverageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, coverageData] = await Promise.all([
        monitoringApi.getKeycloakMetrics(),
        monitoringApi.getTestCoverage().catch(() => null),
      ]);
      setMetrics(metricsData);
      setCoverage(coverageData);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erreur lors de la récupération des métriques plateforme');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRefresh = () => {
    fetchMetrics();
  };

  // Register page-header actions and last-update timestamp.
  useEffect(() => {
    setHeaderActions(
      <Tooltip title="Actualiser les métriques">
        <IconButton onClick={handleRefresh} size="small">
          <Refresh size={20} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  useEffect(() => {
    setHeaderLastUpdate(lastUpdate);
  }, [setHeaderLastUpdate, lastUpdate]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
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

  if (!metrics) {
    return (
      <Alert severity="warning">
        Aucune donnée de métriques disponible
      </Alert>
    );
  }

  const getStatusColor = (value: number, threshold: number) => {
    if (value <= threshold * 0.7) return 'success';
    if (value <= threshold) return 'warning';
    return 'error';
  };

  const getPerformanceColor = (value: number, isLowerBetter = false) => {
    if (isLowerBetter) {
      return value <= 100 ? 'success' : value <= 200 ? 'warning' : 'error';
    }
    return value >= 90 ? 'success' : value >= 70 ? 'warning' : 'error';
  };

  const getCoverageColor = (percent: number): 'success' | 'warning' | 'error' => {
    if (percent >= 80) return 'success';
    if (percent >= 60) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Utilisateurs */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'var(--accent)' }}><Group size={20} strokeWidth={1.75} /></Box>
                Utilisateurs
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" sx={displayValueSx('var(--ink)')}>
                      {metrics.users.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" sx={displayValueSx('var(--ok)')}>
                      {metrics.users.active}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Actifs
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip
                      label={`${metrics.users.newThisWeek} nouveaux`}
                      size="small"
                      icon={<TrendingUp size={16} strokeWidth={1.75} />}
                      sx={chipSx(INFO_TOKEN.fg, INFO_TOKEN.bg)}
                    />
                    <Chip
                      label={`${metrics.users.inactive} inactifs`}
                      size="small"
                      sx={chipSx(NEUTRAL_TOKEN.fg, NEUTRAL_TOKEN.bg)}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Sessions / Tokens */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'var(--accent)' }}><Wifi size={20} strokeWidth={1.75} /></Box>
                Tokens JWT
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" sx={displayValueSx('var(--ink)')}>
                      {metrics.sessions.totalTokens}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total traités
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" sx={displayValueSx('var(--ok)')}>
                      {metrics.sessions.validTokens}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Valides
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip
                      label={`${metrics.sessions.cacheHits} cache hits`}
                      size="small"
                      sx={chipSx(INFO_TOKEN.fg, INFO_TOKEN.bg)}
                    />
                    <Chip
                      label={`${metrics.sessions.revokedTokens} révoqués`}
                      size="small"
                      sx={chipSx(NEUTRAL_TOKEN.fg, NEUTRAL_TOKEN.bg)}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'var(--accent)' }}><TrendingUp size={20} strokeWidth={1.75} /></Box>
                Performance API
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={displayValueSx(SEM_TOKEN[getPerformanceColor(metrics.performance.avgResponseTimeMs, true)].fg)}>
                      {metrics.performance.avgResponseTimeMs}ms
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Temps de réponse moy.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={displayValueSx(SEM_TOKEN[getPerformanceColor(metrics.performance.uptimePercent)].fg)}>
                      {metrics.performance.uptimePercent}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Uptime
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip
                      label={`${metrics.performance.totalRequests} requêtes`}
                      size="small"
                      sx={chipSx(INFO_TOKEN.fg, INFO_TOKEN.bg)}
                    />
                    <Chip
                      label={`${metrics.performance.errorRate}% erreurs`}
                      size="small"
                      sx={chipSx(SEM_TOKEN[getPerformanceColor(100 - metrics.performance.errorRate)].fg, SEM_TOKEN[getPerformanceColor(100 - metrics.performance.errorRate)].bg)}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Sécurité */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'var(--accent)' }}><Security size={20} strokeWidth={1.75} /></Box>
                Sécurité (7 derniers jours)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={displayValueSx(SEM_TOKEN[getStatusColor(metrics.security.failedLogins, 20)].fg)}>
                      {metrics.security.failedLogins}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Échecs de connexion
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={displayValueSx(SEM_TOKEN[getStatusColor(metrics.security.permissionDenied, 10)].fg)}>
                      {metrics.security.permissionDenied}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Accès refusés
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip
                      label={`${metrics.security.suspiciousActivity} activité suspecte`}
                      size="small"
                      sx={chipSx(SEM_TOKEN[metrics.security.suspiciousActivity > 0 ? 'warning' : 'success'].fg, SEM_TOKEN[metrics.security.suspiciousActivity > 0 ? 'warning' : 'success'].bg)}
                    />
                    {metrics.security.lastIncident && (
                      <Chip
                        label={`Dernier incident: ${new Date(metrics.security.lastIncident).toLocaleString()}`}
                        size="small"
                        sx={chipSx(NEUTRAL_TOKEN.fg, NEUTRAL_TOKEN.bg)}
                      />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        {/* Couverture de tests */}
        {coverage && coverage.available && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'var(--accent)' }}><BugReport size={20} strokeWidth={1.75} /></Box>
                  Couverture de Tests
                  {coverage.reportDate && (
                    <Chip
                      label={`Rapport du ${new Date(coverage.reportDate).toLocaleDateString()}`}
                      size="small"
                      sx={{ ...chipSx(NEUTRAL_TOKEN.fg, NEUTRAL_TOKEN.bg), ml: 2 }}
                    />
                  )}
                </Typography>
                <Grid container spacing={3}>
                  {/* Lignes */}
                  {coverage.linePercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <Box textAlign="center">
                        <Typography variant="h4" sx={displayValueSx(SEM_TOKEN[getCoverageColor(coverage.linePercent)].fg)}>
                          {coverage.linePercent}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Lignes
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.linePercent, 100)}
                          color={getCoverageColor(coverage.linePercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {coverage.lineCovered}/{coverage.lineTotal}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {/* Branches */}
                  {coverage.branchPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <Box textAlign="center">
                        <Typography variant="h4" sx={displayValueSx(SEM_TOKEN[getCoverageColor(coverage.branchPercent)].fg)}>
                          {coverage.branchPercent}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Branches
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.branchPercent, 100)}
                          color={getCoverageColor(coverage.branchPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {coverage.branchCovered}/{coverage.branchTotal}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {/* Instructions */}
                  {coverage.instructionPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <Box textAlign="center">
                        <Typography variant="h4" sx={displayValueSx(SEM_TOKEN[getCoverageColor(coverage.instructionPercent)].fg)}>
                          {coverage.instructionPercent}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Instructions
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.instructionPercent, 100)}
                          color={getCoverageColor(coverage.instructionPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {coverage.instructionCovered}/{coverage.instructionTotal}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {/* Méthodes */}
                  {coverage.methodPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <Box textAlign="center">
                        <Typography variant="h4" sx={displayValueSx(SEM_TOKEN[getCoverageColor(coverage.methodPercent)].fg)}>
                          {coverage.methodPercent}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Méthodes
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.methodPercent, 100)}
                          color={getCoverageColor(coverage.methodPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {coverage.methodCovered}/{coverage.methodTotal}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {/* Classes */}
                  {coverage.classPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <Box textAlign="center">
                        <Typography variant="h4" sx={displayValueSx(SEM_TOKEN[getCoverageColor(coverage.classPercent)].fg)}>
                          {coverage.classPercent}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Classes
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.classPercent, 100)}
                          color={getCoverageColor(coverage.classPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {coverage.classCovered}/{coverage.classTotal}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {/* Complexité */}
                  {coverage.complexityPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <Box textAlign="center">
                        <Typography variant="h4" sx={displayValueSx(SEM_TOKEN[getCoverageColor(coverage.complexityPercent)].fg)}>
                          {coverage.complexityPercent}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Complexité
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.complexityPercent, 100)}
                          color={getCoverageColor(coverage.complexityPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {coverage.complexityCovered}/{coverage.complexityTotal}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Message si couverture non disponible */}
        {coverage && !coverage.available && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<BugReport size={20} strokeWidth={1.75} />}>
              {coverage.message || 'Rapport de couverture non disponible. Lancez les tests pour le générer.'}
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default KeycloakMetrics;
