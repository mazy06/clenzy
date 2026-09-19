import { RefreshCwIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from '../ui';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — remaster de components/LoadingStates.tsx (MUI).
 * États de boot applicatif : chargements successifs (app, utilisateur,
 * permissions) et erreur avec relance.
 */
export interface LoadingStatesProps {
  state: 'loading' | 'user-loading' | 'permissions-loading' | 'error-loading' | 'ready';
  error?: string | null;
  onRetry?: () => void;
  onClearError?: () => void;
}

const MESSAGE_KEYS: Record<Exclude<LoadingStatesProps['state'], 'ready' | 'error-loading'>, string> = {
  loading: 'common.loadingApp',
  'user-loading': 'common.loadingProfile',
  'permissions-loading': 'common.loadingPermissions',
};

export default function LoadingStates({ state, error, onRetry, onClearError }: LoadingStatesProps) {
  const { t } = useTranslation();
  if (state === 'ready') return null;

  if (state === 'error-loading') {
    return (
      <div className="flex min-h-48 items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>{t('common.loadAppError')}</AlertTitle>
          <AlertDescription>{error ?? t('common.unexpectedError')}</AlertDescription>
          <div className="col-start-2 mt-2 flex gap-2">
            {onRetry && (
              <Button size="xs" variant="outline" onClick={onRetry}>
                <RefreshCwIcon /> {t('common.retry')}
              </Button>
            )}
            {onClearError && (
              <Button size="xs" variant="ghost" onClick={onClearError}>
                <XIcon /> {t('common.dismiss')}
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
      <Spinner className="size-6" />
      {t(MESSAGE_KEYS[state])}
    </div>
  );
}
