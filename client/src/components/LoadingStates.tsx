import React from 'react';
import { cn } from '../utils/cn';
import { Button, Spinner } from './ui';
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
    <div className="flex flex-col items-center justify-center h-[100vh] gap-3 p-4 bg-background">
      {state === 'error-loading' ? (
        // Alerte pleine largeur — fond -soft + filet destructif a 30 %
        <div
          role="alert"
          className="w-full max-w-[500px] rounded-[12px] px-4 py-[13px] bg-destructive-soft border border-solid border-destructive/30"
        >
          <div className="flex items-center gap-[9px] text-[13.5px] font-bold text-foreground">
            <span className="inline-flex text-destructive">
              <WarningIcon size={17} strokeWidth={1.75} />
            </span>
            {title}
          </div>
          <p className="m-0 mt-1 text-xs text-foreground">
            {description}
          </p>
          {(onRetry || onClearError) && (
            <div className="flex gap-1.5 mt-2">
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <Refresh strokeWidth={1.75} />
                  Réessayer
                </Button>
              )}
              {onClearError && (
                <Button variant="ghost" size="sm" onClick={onClearError}>
                  Ignorer
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <Spinner className="size-8 text-primary" />
          <p className="m-0 text-center text-[16px] font-semibold tracking-[-.01em] text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </p>
          {/* mt: -1 avec theme.spacing = 6 -> -6px, soit -mt-1.5 sur l'echelle Tailwind */}
          <p className="m-0 -mt-1.5 text-center text-xs text-muted-foreground">
            {description}
          </p>
        </>
      )}
    </div>
  );
};
