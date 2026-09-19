import React from 'react';
import { cn } from '../utils/cn';
import { Button, Spinner } from './ui';
import { Refresh, Warning as WarningIcon } from '../icons';
import { useTranslation } from '../hooks/useTranslation';

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
  const { t } = useTranslation();
  const getLoadingContent = () => {
    switch (state) {
      case 'loading':
        return {
          title: t('loadingStates.app'),
          description: t('loadingStates.appHint')
        };
      case 'user-loading':
        return {
          title: t('loadingStates.user'),
          description: t('loadingStates.userHint')
        };
      case 'permissions-loading':
        return {
          title: t('loadingStates.permissions'),
          description: t('loadingStates.permissionsHint')
        };
      case 'error-loading':
        return {
          title: t('loadingStates.error'),
          description: error || t('common.errorOccurred')
        };
      default:
        return {
          title: t('common.loading'),
          description: t('loadingStates.pleaseWait')
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
                  {t('common.retry')}
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
