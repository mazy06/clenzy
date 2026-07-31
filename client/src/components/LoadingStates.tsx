import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Button
} from '@mui/material';
import { Refresh, Warning as WarningIcon } from '../icons';

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
    <div className="flex flex-col items-center justify-center h-[100vh] gap-3 p-4 bg-[var(--bg)]">
      {state === 'error-loading' ? (
        // Alerte pleine largeur — pattern .rm-conflict : fond -soft + border color-mix 30%
        <Box
          role="alert"
          sx={{
            maxWidth: 500,
            width: '100%',
            backgroundColor: 'var(--err-soft)',
            border: '1px solid color-mix(in srgb, var(--err) 30%, transparent)',
            borderRadius: '12px',
            padding: '13px 16px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
            <span className="inline-flex text-[var(--err)]">
              <WarningIcon size={17} strokeWidth={1.75} />
            </span>
            {title}
          </Box>
          <p className="cn-text-body1 text-[12.5px] text-[var(--body)] mt-1">
            {description}
          </p>
          {(onRetry || onClearError) && (
            <div className="flex gap-1.5 mt-2">
              {onRetry && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onRetry}
                  startIcon={<Refresh size={13} strokeWidth={1.75} />}
                >
                  Réessayer
                </Button>
              )}
              {onClearError && (
                <Button
                  variant="text"
                  size="small"
                  onClick={onClearError}
                >
                  Ignorer
                </Button>
              )}
            </div>
          )}
        </Box>
      ) : (
        <>
          <CircularProgress size={32} thickness={3.5} sx={{ color: 'var(--accent)' }} />
          <Typography
            textAlign="center"
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-.01em',
              color: 'var(--ink)',
            }}
          >
            {title}
          </Typography>
          <Typography textAlign="center" sx={{ fontSize: '12.5px', color: 'var(--muted)', mt: -1 }}>
            {description}
          </Typography>
        </>
      )}
    </div>
  );
};
