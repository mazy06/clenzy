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
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Refresh,
  Speed,
  Group,
  Security,
  Storage,
  Wifi,
} from '@mui/icons-material';

interface KeycloakMetricsData {
  users: {
    total: number;
    active: number;
    inactive: number;
    newThisWeek: number;
  };
  sessions: {
    total: number;
    active: number;
    expired: number;
    avgDuration: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    uptime: number;
  };
  security: {
    failedLogins: number;
    lockouts: number;
    suspiciousActivity: number;
    lastIncident: string;
  };
}

const KeycloakMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<KeycloakMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulation des données Keycloak (remplacer par un vrai appel API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockMetrics: KeycloakMetricsData = {
        users: {
          total: 1247,
          active: 1189,
          inactive: 58,
          newThisWeek: 23,
        },
        sessions: {
          total: 892,
          active: 456,
          expired: 436,
          avgDuration: 45,
        },
        performance: {
          responseTime: 125,
          throughput: 1450,
          errorRate: 0.8,
          uptime: 99.7,
        },
        security: {
          failedLogins: 12,
          lockouts: 3,
          suspiciousActivity: 1,
          lastIncident: '2024-01-15 14:30',
        },
      };
      
      setMetrics(mockMetrics);
      setLastUpdate(new Date());
      
    } catch (err) {
      setError('Erreur lors de la récupération des métriques Keycloak');
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <Speed sx={{ mr: 1, color: 'primary.main' }} />
          Métriques Keycloak
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

        {/* Sessions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Wifi sx={{ mr: 1, color: 'primary.main' }} />
                Sessions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">
                      {metrics.sessions.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {metrics.sessions.active}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Actives
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip 
                      label={`${metrics.sessions.avgDuration}min moy.`}
                      color="info"
                      size="small"
                    />
                    <Chip 
                      label={`${metrics.sessions.expired} expirées`}
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
                Performance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" color={getPerformanceColor(metrics.performance.responseTime, true)}>
                      {metrics.performance.responseTime}ms
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Temps de réponse
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h6" color={getPerformanceColor(metrics.performance.uptime)}>
                      {metrics.performance.uptime}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Uptime
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip 
                      label={`${metrics.performance.throughput}/s`}
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
                Sécurité
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
                    <Typography variant="h6" color={getStatusColor(metrics.security.lockouts, 5)}>
                      {metrics.security.lockouts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Comptes verrouillés
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
                    <Chip 
                      label={`Dernier incident: ${metrics.security.lastIncident}`}
                      color="default"
                      size="small"
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default KeycloakMetrics;
