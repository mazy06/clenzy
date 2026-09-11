import * as React from 'react';
import { Skeleton } from '../ui';
import { cn } from '../../utils/cn';
import { useStatTileCompact } from './statTileCompact';
import { Delta } from '../stats/StatsBand';

/**
 * Baitly — remaster de components/StatTile.tsx (MUI) avec le kit Baitly UI.
 * Tuile KPI : icône + libellé, valeur tabular-nums, unité, hint, loading.
 *
 * <p>Dans une rangée déclarée `compact` ({@link ./StatTileRow}), la même tuile
 * se rend en CHIFFRE de bandeau — le langage des Rapports : une ligne de base,
 * pas un pavé. Les appelants n'ont rien à changer ; le `hint`, qui n'a plus sa
 * place sur une ligne, se replie en infobulle native.</p>
 */
export interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** Classe de couleur de l'icône (ex. 'text-success'). Défaut : primaire. */
  iconClassName?: string;
  hint?: React.ReactNode;
  /**
   * Variation vs période précédente. Rendue par le MÊME composant que le
   * bandeau des Rapports : un chiffre bref et teinté, là où une phrase
   * « +3 pts vs période préc. » par tuile remplissait la ligne.
   */
  delta?: number | null;
  /** Unité de la variation (« % » par défaut, « pts » pour un taux). */
  deltaUnit?: string;
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
  delta,
  deltaUnit,
  loading = false,
  onClick,
  className,
}: StatTileProps) {
  const Comp = onClick ? 'button' : 'div';
  const compact = useStatTileCompact();

  if (compact) {
    return (
      <Comp
        onClick={onClick}
        // Le hint disparaît de la ligne mais pas de l'écran : il reste au survol.
        title={typeof hint === 'string' ? hint : undefined}
        className={cn(
          '-mx-1.5 flex items-baseline gap-1.5 rounded-md px-1.5 py-0.5 text-start',
          onClick &&
            'cursor-pointer transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
          className,
        )}
      >
        <span
          className={cn(
            'inline-flex shrink-0 self-center [&>svg]:size-3.5',
            iconClassName ?? 'text-primary',
          )}
        >
          {icon}
        </span>
        {loading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <>
            <b className="cn-font-heading text-lg font-bold tabular-nums text-foreground">{value}</b>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </>
        )}
        <span className="text-xs text-muted-foreground">{label}</span>
        {delta != null && <Delta value={delta} unit={deltaUnit} />}
      </Comp>
    );
  }

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
      {delta != null && (
        <span className="flex items-center">
          <Delta value={delta} unit={deltaUnit} />
        </span>
      )}
      {hint && <span className="text-xs text-muted-foreground [&_b]:font-semibold [&_b]:text-success-ink">{hint}</span>}
    </Comp>
  );
}
