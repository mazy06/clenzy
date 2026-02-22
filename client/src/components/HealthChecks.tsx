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
  Error,
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
  Cloud,
  Memory,
} from '@mui/icons-material';
import type { ChipColor } from '../types';

interface HealthCheckResult {
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  responseTime: number;
  lastCheck: string;
  details: string;
  category: string;
  critical: boolean;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  database: number;
  uptime: number;
}

const HealthChecks: React.FC = () => {
  const [healthChecks, setHealthChecks] = useState<HealthCheckResult[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  const fetchHealthChecks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulation des vérifications de santé (remplacer par un vrai appel API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockHealthChecks: HealthCheckResult[] = [
        {
          name: 'Base de données PostgreSQL',
          status: 'UP',
          responseTime: 45,
          lastCheck: '2024-01-15 14:30:25',
          details: 'Connexion réussie, 125 connexions actives, 0 erreurs',
          category: 'DATABASE',
          critical: true,
        },
        {
          name: 'Service d\'authentification Keycloak',
          status: 'UP',
          responseTime: 120,
          lastCheck: '2024-01-15 14:30:20',
          details: 'Service opérationnel, 456 sessions actives, uptime 99.7%',
          category: 'AUTHENTICATION',
          critical: true,
        },
        {
          name: 'API REST Spring Boot',
          status: 'UP',
          responseTime: 85,
          lastCheck: '2024-01-15 14:30:18',
          details: 'Toutes les routes fonctionnelles, 0 erreurs 5xx',
          category: 'API',
          critical: true,
        },
        {
          name: 'Cache Redis',
          status: 'DEGRADED',
          responseTime: 250,
          lastCheck: '2024-01-15 14:30:15',
          details: 'Performance dégradée, 78% de hit rate (normal: >90%)',
          category: 'CACHE',
          critical: false,
        },
        {
          name: 'Stockage de fichiers',
          status: 'UP',
          responseTime: 65,
          lastCheck: '2024-01-15 14:30:12',
          details: 'Espace disponible: 45.2 GB, 0 erreurs d\'I/O',
          category: 'STORAGE',
          critical: false,
        },
        {
          name: 'Service de notifications',
          status: 'DOWN',
          responseTime: 0,
          lastCheck: '2024-01-15 14:30:10',
          details: 'Service inaccessible, erreur de connexion au serveur SMTP',
          category: 'NOTIFICATIONS',
          critical: false,
        },
        {
          name: 'Monitoring Prometheus',
          status: 'UP',
          responseTime: 95,
          lastCheck: '2024-01-15 14:30:08',
          details: 'Collecte des métriques active, 0 alertes critiques',
          category: 'MONITORING',
          critical: false,
        },
        {
          name: 'Load Balancer Nginx',
          status: 'UP',
          responseTime: 12,
          lastCheck: '2024-01-15 14:30:05',
          details: 'Trafic distribué normalement, 0 erreurs 5xx',
          category: 'NETWORK',
          critical: true,
        },
      ];
      
      const mockSystemMetrics: SystemMetrics = {
        cpu: 23.5,
        memory: 67.8,
        disk: 34.2,
        network: 12.1,
        database: 45.6,
        uptime: 99.7,
      };
      
      setHealthChecks(mockHealthChecks);
      setSystemMetrics(mockSystemMetrics);
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
        return <Error color="error" />;
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

  const overallStatus = healthChecks.length > 0 ? 
    healthChecks.every(check => check.status === 'UP') ? 'UP' :
    healthChecks.some(check => check.status === 'DOWN') ? 'DOWN' : 'DEGRADED' : 'UNKNOWN';

  const criticalChecks = healthChecks.filter(check => check.critical);
  const criticalStatus = criticalChecks.length > 0 ? 
    criticalChecks.every(check => check.status === 'UP') ? 'UP' :
    criticalChecks.some(check => check.status === 'DOWN') ? 'DOWN' : 'DEGRADED' : 'UNKNOWN';

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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <HealthAndSafety sx={{ mr: 1, color: 'primary.main' }} />
          Health Checks Avancés
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
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
                    {systemMetrics.cpu}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    CPU
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemMetrics.cpu} 
                    color={systemMetrics.cpu > 80 ? 'error' : systemMetrics.cpu > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    {systemMetrics.memory}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mémoire
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemMetrics.memory} 
                    color={systemMetrics.memory > 80 ? 'error' : systemMetrics.memory > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    {systemMetrics.disk}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Disque
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemMetrics.disk} 
                    color={systemMetrics.disk > 80 ? 'error' : systemMetrics.disk > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    {systemMetrics.network}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Réseau
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemMetrics.network} 
                    color={systemMetrics.network > 80 ? 'error' : systemMetrics.network > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    {systemMetrics.database}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Base de données
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemMetrics.database} 
                    color={systemMetrics.database > 80 ? 'error' : systemMetrics.database > 60 ? 'warning' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="success.main">
                    {systemMetrics.uptime}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Uptime
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemMetrics.uptime} 
                    color="success"
                    sx={{ mt: 1 }}
                  />
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
                              label={`${check.responseTime}ms`}
                              color={getResponseTimeColor(check.responseTime)}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Dernière vérification:</strong> {check.lastCheck}
                          </Typography>
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
