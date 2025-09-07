import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Button
} from '@mui/material';
import { Refresh } from '@mui/icons-material';

interface LoadingStatesProps {
  state: 'loading' | 'user-loading' | 'permissions-loading' | 'error-loading' | 'ready';
  error?: string | null;
  onRetry?: () => void;
  onClearError?: () => void;
}

export const LoadingStates: React.FC<LoadingStatesProps> = ({
  state,
  error,
  onRetry,
  onClearError
}) => {
  const getLoadingContent = () => {
    switch (state) {
      case 'loading':
        return {
          title: 'Chargement de l\'application...',
          description: 'Initialisation en cours'
        };
      case 'user-loading':
        return {
          title: 'Chargement de l\'utilisateur...',
          description: 'Vérification de l\'authentification'
        };
      case 'permissions-loading':
        return {
          title: 'Chargement des permissions...',
          description: 'Configuration de l\'accès'
        };
      case 'error-loading':
        return {
          title: 'Erreur de chargement',
          description: error || 'Une erreur est survenue'
        };
      default:
        return {
          title: 'Chargement...',
          description: 'Veuillez patienter'
        };
    }
  };

  const { title, description } = getLoadingContent();

  if (state === 'ready') {
    return null;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      gap: 2,
      p: 3
    }}>
      {state === 'error-loading' ? (
        <Alert 
          severity="error" 
          sx={{ mb: 2, maxWidth: 500 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              {onRetry && (
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={onRetry}
                  startIcon={<Refresh />}
                >
                  Réessayer
                </Button>
              )}
              {onClearError && (
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={onClearError}
                >
                  Ignorer
                </Button>
              )}
            </Box>
          }
        >
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2">
            {description}
          </Typography>
        </Alert>
      ) : (
        <>
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary" textAlign="center">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {description}
          </Typography>
        </>
      )}
    </Box>
  );
};
