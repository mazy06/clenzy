import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Badge,
  Chip,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh,
  Delete,
  Security,
  Warning,
  CheckCircle,
  Error,
  Info,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import TokenService, { TokenStats, TokenMetrics } from '../services/TokenService';

interface TokenInfo {
  tokenId: string;
  subject: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  isValid: boolean;
  timeUntilExpiry: number;
}

const TokenMonitoring: React.FC = () => {
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tokenService = TokenService.getInstance();

  const loadTokenStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const stats = await tokenService.getBackendTokenStats();
      const metrics = await tokenService.getBackendTokenMetrics();
      
      if (stats) setTokenStats(stats);
      if (metrics) setTokenMetrics(metrics);
      
    } catch (error) {
      setError('Impossible de charger les statistiques des tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupTokens = async () => {
    try {
      setIsLoading(true);
      const result = await tokenService.cleanupExpiredTokens();
      
      if (result.success) {
        await loadTokenStats(); // Recharger les stats
      } else {
        setError(`Erreur lors du nettoyage: ${result.error}`);
      }
    } catch (error) {
      setError('Erreur lors du nettoyage des tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const validateToken = async (token: string) => {
    try {
      const result = await tokenService.validateTokenBackend(token);
      if (result) {
        return result;
      }
    } catch (error) {
    }
    return null;
  };

  const showTokenInfo = (token: TokenInfo) => {
    setSelectedToken(token);
    setShowTokenDetails(true);
  };

  useEffect(() => {
    loadTokenStats();
  }, []);

  const getCurrentTokenInfo = () => {
    return tokenService.getCurrentTokenInfo();
  };

  const currentToken = getCurrentTokenInfo();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        🔐 Monitoring des Tokens
      </Typography>

      {/* Token actuel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Token Actuel
          </Typography>
          
          {currentToken.isAuthenticated ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Utilisateur: <strong>{currentToken.username || currentToken.userId}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Email: <strong>{currentToken.email || 'N/A'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rôles: <strong>{currentToken.roles?.join(', ') || 'Aucun'}</strong>
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Expire le: <strong>{currentToken.expiresAt || 'N/A'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Temps restant: <strong>{currentToken.timeUntilExpiry || 0}s</strong>
                </Typography>
                <Chip
                  label={currentToken.isAuthenticated ? 'Authentifié' : 'Non authentifié'}
                  color={currentToken.isAuthenticated ? 'success' : 'error'}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Grid>
            </Grid>
          ) : (
            <Alert severity="warning">
              Aucun token actif trouvé
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={loadTokenStats}
          disabled={isLoading}
          startIcon={<Refresh />}
        >
          {isLoading ? 'Chargement...' : 'Actualiser'}
        </Button>
        
        <Button
          variant="outlined"
          onClick={cleanupTokens}
          disabled={isLoading}
          startIcon={<Delete />}
          color="warning"
        >
          Nettoyer les tokens expirés
        </Button>
      </Box>

      {/* Statistiques */}
      {tokenStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">
                  {tokenStats.totalTokens || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total des tokens
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success">
                  {tokenStats.activeTokens || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tokens actifs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="error">
                  {tokenStats.expiredTokens || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tokens expirés
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info">
                  {tokenStats.successRate || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Taux de succès
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Métriques */}
      {tokenMetrics && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Métriques des Tokens
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Rafraîchissements: <strong>{tokenMetrics.refreshCount || 0}</strong>
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Erreurs: <strong>{tokenMetrics.errorCount || 0}</strong>
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Dernier rafraîchissement: <strong>{tokenMetrics.lastRefresh || 'N/A'}</strong>
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Temps moyen: <strong>{tokenMetrics.averageRefreshTime || 0}ms</strong>
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Gestion des erreurs */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Note sur l'architecture */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          💡 <strong>Architecture réactive :</strong> Ce composant utilise maintenant la nouvelle interface 
          de TokenService avec le pattern Observer pour une gestion intelligente des tokens !
        </Typography>
      </Alert>

      {/* Dialog pour les détails du token */}
      <Dialog open={showTokenDetails} onClose={() => setShowTokenDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>Détails du Token</DialogTitle>
        <DialogContent>
          {selectedToken && (
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>ID:</strong> {selectedToken.tokenId}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Sujet:</strong> {selectedToken.subject}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Émetteur:</strong> {selectedToken.issuer}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Émis le:</strong> {selectedToken.issuedAt}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Expire le:</strong> {selectedToken.expiresAt}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Valide:</strong> {selectedToken.isValid ? 'Oui' : 'Non'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Temps restant:</strong> {selectedToken.timeUntilExpiry}s
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTokenDetails(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TokenMonitoring;



