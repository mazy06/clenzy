import React, { ReactNode } from 'react';
import { Spinner, Button, Alert, Skeleton, Card, CardContent } from './ui';
import { Refresh as RefreshIcon, ErrorOutline, Close as CloseIcon } from '../icons';

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
  <Card className="mb-3">
    <CardContent>
      <Skeleton className="h-7 w-[60%] mb-1.5" />
      <Skeleton className="h-5 w-full mb-1" />
      <Skeleton className="h-5 w-[80%]" />
      <div className="flex gap-1.5 mt-2">
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-[60px] rounded-md" />
      </div>
    </CardContent>
  </Card>
);

// Composant spinner centré
const CenteredSpinner: React.FC<{ size: number; message?: string; minHeight: string | number }> = ({
  size,
  message,
  minHeight,
}) => (
  // minHeight vient des props (runtime) : style inline, pas de classe Tailwind.
  <div className="flex flex-col justify-center items-center gap-[9px]" style={{ minHeight }}>
    {/* La taille vient des props (runtime) : style inline, pas de classe Tailwind. */}
    <Spinner className="text-primary" style={{ width: size, height: size }} />
    {message && (
      <p className="m-0 text-xs text-muted-foreground">
        {message}
      </p>
    )}
  </div>
);

// Composant erreur
const ErrorDisplay: React.FC<{
  error: string;
  onRetry?: () => void;
  onClearError?: () => void;
}> = ({ error, onRetry, onClearError }) => (
  // Alerte -soft hairline. Le contenu est pose dans une rangee flex plutot que
  // dans AlertAction : le libelle « Reessayer » depasse la gouttiere de 72px que
  // le primitif reserve a une action absolue.
  <Alert
    variant="destructive"
    className="mb-3 py-1.5 bg-destructive-soft border border-solid border-destructive/30 rounded-[12px]"
  >
    <div className="flex items-center gap-2 w-full">
      <ErrorOutline size={16} strokeWidth={1.75} className="text-destructive shrink-0" />
      <span className="flex-1 text-xs text-foreground">{error}</span>
      {onRetry && (
        // Action d'appoint dans une alerte : ghost, pas de cadre au repos.
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshIcon size={13} strokeWidth={1.75} />
          Réessayer
        </Button>
      )}
      {onClearError && (
        <Button variant="ghost" size="icon-sm" aria-label="Fermer l'erreur" onClick={onClearError}>
          <CloseIcon size={14} strokeWidth={1.75} />
        </Button>
      )}
    </div>
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
          <div>
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        );
      case 'inline':
        return (
          <div className="flex items-center gap-1.5 py-1.5">
            <Spinner className="size-5" />
            {loadingMessage && (
              <p className="m-0 text-xs text-muted-foreground">
                {loadingMessage}
              </p>
            )}
          </div>
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
