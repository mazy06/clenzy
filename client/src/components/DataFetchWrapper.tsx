import React, { ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Button,
  Skeleton,
  Card,
  CardContent,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

/**
 * Wrapper réutilisable pour le rendu conditionnel basé sur l'état de chargement/erreur.
 * Élimine le boilerplate de gestion loading/error dans les composants.
 *
 * @example
 * <DataFetchWrapper loading={loading} error={error} onRetry={retry}>
 *   <MyComponent data={data} />
 * </DataFetchWrapper>
 *
 * @example
 * <DataFetchWrapper loading={loading} error={error} variant="skeleton" skeletonCount={3}>
 *   <PropertyList properties={data} />
 * </DataFetchWrapper>
 */

interface DataFetchWrapperProps {
  /** État de chargement */
  loading: boolean;
  /** Message d'erreur (null = pas d'erreur) */
  error: string | null;
  /** Contenu à afficher quand les données sont chargées */
  children: ReactNode;
  /** Callback de retry */
  onRetry?: () => void;
  /** Callback pour fermer l'erreur */
  onClearError?: () => void;
  /** Variante du loader ('spinner' | 'skeleton' | 'inline') */
  variant?: 'spinner' | 'skeleton' | 'inline';
  /** Nombre de skeletons à afficher */
  skeletonCount?: number;
  /** Hauteur minimum du conteneur de chargement */
  minHeight?: string | number;
  /** Taille du spinner */
  spinnerSize?: number;
  /** Message de chargement personnalisé */
  loadingMessage?: string;
  /** Afficher le contenu même en cas d'erreur (l'erreur sera affichée au-dessus) */
  showContentOnError?: boolean;
  /** Contenu à afficher quand les données sont vides */
  emptyState?: ReactNode;
  /** Vérifier si les données sont vides */
  isEmpty?: boolean;
}

// Composant skeleton pour les cartes
const CardSkeleton: React.FC = () => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Skeleton variant="text" width="60%" height={28} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="100%" height={20} />
      <Skeleton variant="text" width="80%" height={20} />
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Skeleton variant="rounded" width={80} height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
      </Box>
    </CardContent>
  </Card>
);

// Composant spinner centré
const CenteredSpinner: React.FC<{ size: number; message?: string; minHeight: string | number }> = ({
  size,
  message,
  minHeight,
}) => (
  <Box
    display="flex"
    flexDirection="column"
    justifyContent="center"
    alignItems="center"
    minHeight={minHeight}
    gap={1.5}
  >
    <CircularProgress size={size} />
    {message && (
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    )}
  </Box>
);

// Composant erreur
const ErrorDisplay: React.FC<{
  error: string;
  onRetry?: () => void;
  onClearError?: () => void;
}> = ({ error, onRetry, onClearError }) => (
  <Alert
    severity="error"
    sx={{ mb: 2, py: 1 }}
    onClose={onClearError}
    action={
      onRetry ? (
        <Button
          color="inherit"
          size="small"
          onClick={onRetry}
          startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
        >
          Réessayer
        </Button>
      ) : undefined
    }
  >
    {error}
  </Alert>
);

const DataFetchWrapper: React.FC<DataFetchWrapperProps> = ({
  loading,
  error,
  children,
  onRetry,
  onClearError,
  variant = 'spinner',
  skeletonCount = 3,
  minHeight = '200px',
  spinnerSize = 32,
  loadingMessage,
  showContentOnError = false,
  emptyState,
  isEmpty = false,
}) => {
  // État de chargement
  if (loading) {
    switch (variant) {
      case 'skeleton':
        return (
          <Box>
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </Box>
        );
      case 'inline':
        return (
          <Box display="flex" alignItems="center" gap={1} py={1}>
            <CircularProgress size={20} />
            {loadingMessage && (
              <Typography variant="body2" color="text.secondary">
                {loadingMessage}
              </Typography>
            )}
          </Box>
        );
      default:
        return (
          <CenteredSpinner
            size={spinnerSize}
            message={loadingMessage}
            minHeight={minHeight}
          />
        );
    }
  }

  // État d'erreur
  if (error) {
    if (showContentOnError) {
      return (
        <>
          <ErrorDisplay error={error} onRetry={onRetry} onClearError={onClearError} />
          {children}
        </>
      );
    }
    return <ErrorDisplay error={error} onRetry={onRetry} onClearError={onClearError} />;
  }

  // État vide
  if (isEmpty && emptyState) {
    return <>{emptyState}</>;
  }

  // Contenu normal
  return <>{children}</>;
};

export default DataFetchWrapper;
