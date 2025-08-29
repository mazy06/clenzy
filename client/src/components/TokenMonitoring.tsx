import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Snackbar,
  LinearProgress,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Security,
  Refresh,
  Delete,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Error,
  Warning,
  Info
} from '@mui/icons-material';
import TokenService, { TokenStats, TokenMetrics, TokenValidationResult } from '../services/TokenService';

interface TokenMonitoringProps {
  isAdmin?: boolean;
}

const TokenMonitoring: React.FC<TokenMonitoringProps> = ({ isAdmin = false }) => {
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const tokenService = new TokenService();

  const loadTokenStats = useCallback(async () => {
    try {
      setLoading(true);
      const stats = await tokenService.getBackendTokenStats();
      setTokenStats(stats);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des statistiques des tokens');
      console.error('Erreur chargement stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTokenMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const metrics = await tokenService.getBackendTokenMetrics();
      setTokenMetrics(metrics);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des métriques des tokens');
      console.error('Erreur chargement métriques:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCleanup = async () => {
    try {
      setLoading(true);
      await tokenService.cleanupBackendTokens();
      setNotification({
        open: true,
        message: 'Nettoyage des tokens expirés effectué avec succès',
        severity: 'success'
      });
      await loadTokenStats(); // Recharger les stats
    } catch (err) {
      setNotification({
        open: true,
        message: 'Erreur lors du nettoyage des tokens',
        severity: 'error'
      });
      console.error('Erreur nettoyage:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadTokenStats();
    loadTokenMetrics();
  };

  useEffect(() => {
    loadTokenStats();
    loadTokenMetrics();
  }, [loadTokenStats, loadTokenMetrics]);

  if (!isAdmin) {
    return (
      <Alert severity="warning">
        Accès restreint. Seuls les administrateurs peuvent accéder au monitoring des tokens.
      </Alert>
    );
  }

  return (
    <Box>
      {/* En-tête avec actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          Monitoring des Tokens JWT
        </Typography>
        <Box>
          <Tooltip title="Actualiser les données">
            <IconButton onClick={handleRefresh} disabled={loading} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Nettoyer les tokens expirés">
            <IconButton onClick={handleCleanup} disabled={loading} color="warning">
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Statistiques des tokens */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Security sx={{ mr: 1, color: 'primary.main' }} />
                Statistiques des Tokens
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : tokenStats ? (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="primary">
                          {(tokenStats.validTokens || 0) + (tokenStats.invalidTokens || 0) + (tokenStats.revokedTokens || 0) + (tokenStats.rejectedTokens || 0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Tokens
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="success.main">
                          {tokenStats.validTokens || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Tokens Valides
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="warning.main">
                          {tokenStats.invalidTokens || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Tokens Invalides
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="error.main">
                          {tokenStats.revokedTokens || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Tokens Révoqués
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Typography color="text.secondary">Aucune donnée disponible</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                Métriques de Performance
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : tokenMetrics ? (
                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Taux de Succès
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {tokenMetrics.successRate}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Cache Hits
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {tokenMetrics.cacheHits}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Erreurs
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {tokenMetrics.errors}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography color="text.secondary">Aucune donnée disponible</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* État du système */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Info sx={{ mr: 1, color: 'info.main' }} />
            État du Système
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Badge badgeContent={tokenStats?.cacheSize || 0} color="primary">
                  <Security sx={{ fontSize: 40, color: 'primary.main' }} />
                </Badge>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Cache Actif
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Badge badgeContent={tokenStats?.blacklistSize || 0} color="error">
                  <Delete sx={{ fontSize: 40, color: 'error.main' }} />
                </Badge>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Blacklist
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Système OK
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
                              <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h6" color="primary">
                    {tokenStats?.lastCleanup || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Dernier Nettoyage
                  </Typography>
                </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Actions d'administration */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Security sx={{ mr: 1, color: 'warning.main' }} />
            Actions d'Administration
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Actualiser
            </Button>
            
            <Button
              variant="outlined"
              color="warning"
              startIcon={<Delete />}
              onClick={handleCleanup}
              disabled={loading}
            >
              Nettoyer les Tokens
            </Button>
            
            <Button
              variant="outlined"
              color="info"
              startIcon={<Info />}
              disabled={loading}
            >
              Voir les Logs
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Affichage des erreurs */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default TokenMonitoring;



