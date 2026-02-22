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
} from '@mui/icons-material';
import type { ChipColor } from '../types';
import { monitoringApi } from '../services/api/monitoringApi';
import type { HealthCheckService, SystemMetrics } from '../services/api/monitoringApi';

const HealthChecks: React.FC = () => {
  const [healthChecks, setHealthChecks] = useState<HealthCheckService[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

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
        return <CheckCircle color="success" />;
      case 'DOWN':
        return <ErrorIcon color="error" />;
      case 'DEGRADED':
        return <Warning color="warning" />;
      default:
        return <Info color="info" />;
    }
  };

  const getStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'UP':
        return 'success';
      case 'DOWN':
        return 'error';
      case 'DEGRADED':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'DATABASE':
        return <StorageIcon />;
      case 'AUTHENTICATION':
        return <Security />;
      case 'API':
        return <Speed />;
      case 'CACHE':
        return <Memory />;
      case 'STORAGE':
        return <StorageIcon />;
      case 'NOTIFICATIONS':
        return <Info />;
      case 'MONITORING':
        return <HealthAndSafety />;
      case 'NETWORK':
        return <Wifi />;
      default:
        return <Info />;
    }
  };

  const getResponseTimeColor = (responseTime: number): ChipColor => {
    if (responseTime <= 100) return 'success';
    if (responseTime <= 300) return 'warning';
    return 'error';
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <HealthAndSafety sx={{ mr: 1, color: 'primary.main' }} />
          Health Checks
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          {loading && <CircularProgress size={16} />}
          <Tooltip title="Actualiser les vérifications">
            <IconButton onClick={handleRefresh} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Vue d'ensemble */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <HealthAndSafety sx={{ mr: 1, color: 'primary.main' }} />
                Statut Global
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {getStatusIcon(overallStatus)}
                <Typography variant="h4" color={`${getStatusColor(overallStatus)}.main`}>
                  {overallStatus}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {healthChecks.filter(check => check.status === 'UP').length} sur {healthChecks.length} services opérationnels
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Security sx={{ mr: 1, color: 'error.main' }} />
                Services Critiques
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {getStatusIcon(criticalStatus)}
                <Typography variant="h4" color={`${getStatusColor(criticalStatus)}.main`}>
                  {criticalStatus}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {criticalChecks.filter(check => check.status === 'UP').length} sur {criticalChecks.length} services critiques opérationnels
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Métriques système */}
      {systemMetrics && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Métriques Système
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    {systemMetrics.cpuUsage}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    CPU
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(systemMetrics.cpuUsage, 100)}
                    color={systemMetrics.cpuUsage > 80 ? 'error' : systemMetrics.cpuUsage > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    {systemMetrics.memoryUsage}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mémoire ({systemMetrics.heapUsedMb}/{systemMetrics.heapMaxMb} MB)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(systemMetrics.memoryUsage, 100)}
                    color={systemMetrics.memoryUsage > 80 ? 'error' : systemMetrics.memoryUsage > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    {systemMetrics.diskUsage}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Disque
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(systemMetrics.diskUsage, 100)}
                    color={systemMetrics.diskUsage > 80 ? 'error' : systemMetrics.diskUsage > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h6" color="success.main">
                    {formatUptime(systemMetrics.uptimeSeconds)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Uptime JVM
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Vérifications détaillées */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
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
                          color={getStatusColor(check.status)}
                          size="small"
                        />
                        <Chip
                          label={check.category}
                          variant="outlined"
                          size="small"
                          icon={getCategoryIcon(check.category)}
                        />
                        {check.critical && (
                          <Chip
                            label="CRITIQUE"
                            color="error"
                            size="small"
                            variant="outlined"
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
                              color={getResponseTimeColor(check.responseTimeMs)}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                          {check.lastCheck && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Dernière vérification:</strong> {new Date(check.lastCheck).toLocaleTimeString()}
                            </Typography>
                          )}
                        </Box>

                        <Collapse in={expandedChecks.has(check.name)}>
                          <Box mt={1} p={2} bgcolor="grey.50" borderRadius={1}>
                            <Typography variant="body2" color="text.primary">
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
                    {expandedChecks.has(check.name) ? <ExpandLess /> : <ExpandMore />}
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
