import * as React from 'react';
import { Skeleton } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/StatTile.tsx (MUI) avec le kit Baitly UI.
 * Tuile KPI : icône + libellé, valeur tabular-nums, unité, hint, loading.
 */
export interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** Classe de couleur de l'icône (ex. 'text-success'). Défaut : primaire. */
  iconClassName?: string;
  hint?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function StatTile({
  icon,
  label,
  value,
  unit,
  iconClassName,
  hint,
  loading = false,
  onClick,
  className,
}: StatTileProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-4 text-start',
        onClick &&
          'cursor-pointer transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn('inline-flex shrink-0 [&>svg]:size-3.5', iconClassName ?? 'text-primary')}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <span className="flex items-baseline gap-1">
          <span className="cn-font-heading text-[1.375rem] min-[900px]:text-[1.6875rem] font-semibold text-foreground tabular-nums">
            {value}
          </span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </span>
      )}
      {hint && <span className="text-xs text-muted-foreground [&_b]:font-semibold [&_b]:text-success-ink">{hint}</span>}
    </Comp>
  );
}
