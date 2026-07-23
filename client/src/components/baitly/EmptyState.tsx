import * as React from 'react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/EmptyState.tsx (MUI), construit sur le
 * composant Empty du kit. Variantes de bordure + bandeau d'astuce conservés.
 */
export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** Astuce contextuelle affichée dans un bandeau discret en bas. */
  tip?: React.ReactNode;
  variant?: 'dashed' | 'plain' | 'transparent';
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  tip,
  variant = 'dashed',
  className,
}: EmptyStateProps) {
  return (
    <Empty
      className={cn(
        variant === 'dashed' && 'border border-dashed',
        variant === 'plain' && 'border',
        className
      )}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {(action || secondaryAction) && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action}
            {secondaryAction}
          </div>
        </EmptyContent>
      )}
      {tip && (
        <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {tip}
        </div>
      )}
    </Empty>
  );
}
