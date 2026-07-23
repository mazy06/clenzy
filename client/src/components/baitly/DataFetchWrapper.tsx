import type { ReactNode } from 'react';
import { RefreshCwIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from '../ui';
import ListSkeleton from './ListSkeleton';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/DataFetchWrapper.tsx (MUI).
 * Orchestration loading / erreur / vide autour d'un contenu fetché.
 */
export interface DataFetchWrapperProps {
  loading: boolean;
  error: string | null;
  children: ReactNode;
  onRetry?: () => void;
  onClearError?: () => void;
  variant?: 'spinner' | 'skeleton' | 'inline';
  skeletonCount?: number;
  minHeight?: string | number;
  loadingMessage?: string;
  /** Affiche le contenu sous l'erreur (données périmées visibles). */
  showContentOnError?: boolean;
  emptyState?: ReactNode;
  isEmpty?: boolean;
  className?: string;
}

export default function DataFetchWrapper({
  loading,
  error,
  children,
  onRetry,
  onClearError,
  variant = 'spinner',
  skeletonCount = 6,
  minHeight,
  loadingMessage,
  showContentOnError = false,
  emptyState,
  isEmpty = false,
  className,
}: DataFetchWrapperProps) {
  if (loading) {
    if (variant === 'skeleton') return <ListSkeleton rows={skeletonCount} className={className} />;
    return (
      <div
        style={{ minHeight }}
        className={cn(
          'flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground',
          variant === 'inline' && 'justify-start py-2',
          className
        )}
      >
        <Spinner />
        {loadingMessage}
      </div>
    );
  }

  return (
    <div style={{ minHeight }} className={className}>
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
      )}
      {(!error || showContentOnError) && (isEmpty && emptyState ? emptyState : children)}
    </div>
  );
}
