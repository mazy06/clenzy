import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Button, 
  Alert,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh,
  Warning,
  CheckCircle,
  Error,
  Schedule,
  Security,
} from '../icons';
import TokenService from '../services/TokenService';
import { useTokenHealth } from '../hooks/useTokenHealth';

export const TokenHealthMonitor: React.FC = () => {
  const {
    isHealthy,
    status,
    timeUntilExpiry,
    lastCheck,
    isLoading,
    forceCheck,
    isExpiringSoon,
    isCritical,
    timeUntilExpiryFormatted
  } = useTokenHealth();

  // Obtenir l'icône et la couleur selon le statut
  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><CheckCircle size={20} strokeWidth={1.75} /></Box>;
      case 'expiring':
        return <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}><Warning size={20} strokeWidth={1.75} /></Box>;
      case 'expired':
        return <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><Error size={20} strokeWidth={1.75} /></Box>;
      case 'error':
        return <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><Error size={20} strokeWidth={1.75} /></Box>;
      default:
        return <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><Security size={20} strokeWidth={1.75} /></Box>;
    }
  };

  const getStatusColor = (): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'expiring':
        return isCritical ? 'error' : 'warning';
      case 'expired':
        return 'error';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'healthy':
        return 'Token en bonne santé';
      case 'expiring':
        return isCritical 
          ? `Token critique - Expire dans ${timeUntilExpiryFormatted}`
          : `Token expirant - Expire dans ${timeUntilExpiryFormatted}`;
      case 'expired':
        return 'Token expiré';
      case 'error':
        return 'Erreur de token';
      default:
        return 'Statut inconnu';
    }
  };

  // Calculer le pourcentage d'expiration pour la barre de progression
  const getExpiryPercentage = () => {
    if (!timeUntilExpiry || status !== 'expiring') return 0;
    // Supposons que le token expire dans 5 minutes (300 secondes)
    const maxTime = 300;
    const remaining = Math.max(0, timeUntilExpiry);
    return ((maxTime - remaining) / maxTime) * 100;
  };

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'primary.main' }}><Security size={20} strokeWidth={1.75} /></Box>
          <Typography variant="h6" component="h2">
            Moniteur de Santé des Tokens
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title="Vérifier maintenant">
              <IconButton 
                onClick={forceCheck} 
                disabled={isLoading}
                size="small"
              >
                <Refresh size={20} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Statut principal */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getStatusIcon()}
          <Typography variant="body1" sx={{ ml: 1, fontWeight: 500 }}>
            {getStatusText()}
          </Typography>
          <Chip 
            label={status.toUpperCase()} 
            color={getStatusColor()}
            size="small"
            sx={{ ml: 'auto' }}
          />
        </Box>

        {/* Barre de progression pour l'expiration */}
        {status === 'expiring' && timeUntilExpiry && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Temps restant
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {timeUntilExpiryFormatted}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={getExpiryPercentage()} 
              color={isCritical ? 'error' : 'warning'}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* Alertes selon le statut */}
        {isCritical && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ⚠️ <strong>Attention !</strong> Votre session expire bientôt. 
              Veuillez sauvegarder votre travail.
            </Typography>
          </Alert>
        )}

        {isExpiringSoon && !isCritical && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ⏰ Votre session expire dans {timeUntilExpiryFormatted}. 
              Le rafraîchissement automatique est en cours...
            </Typography>
          </Alert>
        )}

        {status === 'healthy' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ✅ Votre session est en bonne santé et sera automatiquement maintenue.
            </Typography>
          </Alert>
        )}

        {status === 'expired' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ❌ Votre session a expiré. Vous allez être redirigé vers la page de connexion.
            </Typography>
          </Alert>
        )}

        {/* Informations détaillées */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Informations techniques :
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Dernière vérification :
            </Typography>
            <Typography variant="body2">
              {lastCheck.toLocaleTimeString()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Statut de santé :
            </Typography>
            <Typography variant="body2">
              {isHealthy ? '✅ Bon' : '❌ Mauvais'}
            </Typography>
          </Box>
          {timeUntilExpiry !== undefined && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Temps avant expiration :
              </Typography>
              <Typography variant="body2">
                {timeUntilExpiry > 0 ? `${timeUntilExpiry}s` : 'Expiré'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={forceCheck}
            disabled={isLoading}
            startIcon={<Refresh size={18} strokeWidth={1.75} />}
            size="small"
          >
            {isLoading ? 'Vérification...' : 'Vérifier maintenant'}
          </Button>
          
          {status === 'expiring' && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Schedule size={18} strokeWidth={1.75} />}
            >
              Rafraîchir manuellement
            </Button>
          )}
        </Box>

        {/* Note sur l'architecture */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="caption" color="info.contrastText">
            💡 <strong>Architecture réactive :</strong> Ce composant utilise le pattern Observer 
            pour écouter les événements de token en temps réel, sans polling automatique !
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
