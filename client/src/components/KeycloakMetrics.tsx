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
  Speed,
  Group,
  Security,
  Wifi,
  BugReport,
} from '@mui/icons-material';
import { monitoringApi } from '../services/api/monitoringApi';
import type { KeycloakMetricsResponse, TestCoverageMetrics } from '../services/api/monitoringApi';

const KeycloakMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<KeycloakMetricsResponse | null>(null);
  const [coverage, setCoverage] = useState<TestCoverageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <Speed sx={{ mr: 1, color: 'primary.main' }} />
          Métriques Plateforme
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          <Tooltip title="Actualiser les métriques">
            <IconButton onClick={handleRefresh} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Utilisateurs */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Group sx={{ mr: 1, color: 'primary.main' }} />
                Utilisateurs
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">
                      {metrics.users.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
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
                      color="info"
                      size="small"
                      icon={<TrendingUp />}
                    />
                    <Chip
                      label={`${metrics.users.inactive} inactifs`}
                      color="default"
                      size="small"
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Sessions / Tokens */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Wifi sx={{ mr: 1, color: 'primary.main' }} />
                Tokens JWT
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">
                      {metrics.sessions.totalTokens}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total traités
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
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
                      color="info"
                      size="small"
                    />
                    <Chip
                      label={`${metrics.sessions.revokedTokens} révoqués`}
                      color="default"
                      size="small"
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp sx={{ mr: 1, color: 'primary.main' }} />
                Performance API
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" color={getPerformanceColor(metrics.performance.avgResponseTimeMs, true)}>
                      {metrics.performance.avgResponseTimeMs}ms
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Temps de réponse moy.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" color={getPerformanceColor(metrics.performance.uptimePercent)}>
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
                      color="info"
                      size="small"
                    />
                    <Chip
                      label={`${metrics.performance.errorRate}% erreurs`}
                      color={getPerformanceColor(100 - metrics.performance.errorRate)}
                      size="small"
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Sécurité */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Security sx={{ mr: 1, color: 'primary.main' }} />
                Sécurité (7 derniers jours)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" color={getStatusColor(metrics.security.failedLogins, 20)}>
                      {metrics.security.failedLogins}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Échecs de connexion
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" color={getStatusColor(metrics.security.permissionDenied, 10)}>
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
                      color={metrics.security.suspiciousActivity > 0 ? 'warning' : 'success'}
                      size="small"
                    />
                    {metrics.security.lastIncident && (
                      <Chip
                        label={`Dernier incident: ${new Date(metrics.security.lastIncident).toLocaleString()}`}
                        color="default"
                        size="small"
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
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <BugReport sx={{ mr: 1, color: 'primary.main' }} />
                  Couverture de Tests
                  {coverage.reportDate && (
                    <Chip
                      label={`Rapport du ${new Date(coverage.reportDate).toLocaleDateString()}`}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 2 }}
                    />
                  )}
                </Typography>
                <Grid container spacing={3}>
                  {/* Lignes */}
                  {coverage.linePercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <Box textAlign="center">
                        <Typography variant="h4" color={`${getCoverageColor(coverage.linePercent)}.main`}>
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
                        <Typography variant="h4" color={`${getCoverageColor(coverage.branchPercent)}.main`}>
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
                        <Typography variant="h4" color={`${getCoverageColor(coverage.instructionPercent)}.main`}>
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
                        <Typography variant="h4" color={`${getCoverageColor(coverage.methodPercent)}.main`}>
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
                        <Typography variant="h4" color={`${getCoverageColor(coverage.classPercent)}.main`}>
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
                        <Typography variant="h4" color={`${getCoverageColor(coverage.complexityPercent)}.main`}>
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
            <Alert severity="info" icon={<BugReport />}>
              {coverage.message || 'Rapport de couverture non disponible. Lancez les tests pour le générer.'}
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default KeycloakMetrics;
