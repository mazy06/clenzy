import { RefreshCwIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from '../ui';

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

const MESSAGES: Record<Exclude<LoadingStatesProps['state'], 'ready' | 'error-loading'>, string> = {
  loading: "Chargement de l'application…",
  'user-loading': 'Chargement de votre profil…',
  'permissions-loading': 'Chargement de vos permissions…',
};

export default function LoadingStates({ state, error, onRetry, onClearError }: LoadingStatesProps) {
  if (state === 'ready') return null;

  if (state === 'error-loading') {
    return (
      <div className="flex min-h-48 items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Impossible de charger l'application</AlertTitle>
          <AlertDescription>{error ?? 'Une erreur inattendue est survenue.'}</AlertDescription>
          <div className="col-start-2 mt-2 flex gap-2">
            {onRetry && (
              <Button size="xs" variant="outline" onClick={onRetry}>
                <RefreshCwIcon /> Réessayer
              </Button>
            )}
            {onClearError && (
              <Button size="xs" variant="ghost" onClick={onClearError}>
                <XIcon /> Ignorer
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
      {MESSAGES[state]}
    </div>
  );
}
