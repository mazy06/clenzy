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
        {/* Chiffre et unite forment l'ANCRE de la variation : celle-ci s'y
            accroche hors flux (cf. `Delta`), donc « 44,7 % » et « Occupation »
            restent colles au lieu d'etre ecartes par un « +212,6 pts ». */}
        <span className="relative inline-flex items-baseline gap-1">
          {/*
            Le squelette vit DANS la boite du chiffre, et cette boite garde une
            largeur minimale dans les deux etats.

            Avant, il occupait soixante-quatre pixels puis cedait la place a
            « 54 » : le libelle qui suit sautait de pres de cinquante pixels vers
            la gauche, une fraction de seconde apres le chargement. `2.5ch` se
            mesure sur la fonte du chiffre lui-meme — la boite vide et la boite
            pleine ont donc la meme largeur tant que la valeur tient sur deux a
            trois caracteres, c'est-a-dire presque toujours.
          */}
          <b className="cn-font-heading inline-block min-w-[2.5ch] text-lg font-bold tabular-nums text-foreground">
            {loading
              ? <Skeleton className="inline-block h-[1em] w-full align-baseline rounded-sm" />
              : value}
          </b>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          {delta != null && !loading && <Delta value={delta} unit={deltaUnit} />}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
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
      {/*
        Meme principe que la rangee compacte : le squelette se loge dans la boite
        du chiffre plutot que de la remplacer. Un bloc de vingt-huit pixels
        remplace par un texte d'une trentaine faisait remonter la variation et le
        hint au chargement. `1em` se mesure sur la fonte du chiffre, donc la
        hauteur est la meme avant et apres, aux deux paliers responsifs.
      */}
      <span className="flex items-baseline gap-1">
        <span className="cn-font-heading inline-block min-w-[3ch] text-[1.375rem] min-[900px]:text-[1.6875rem] font-semibold text-foreground tabular-nums">
          {loading
            ? <Skeleton className="inline-block h-[1em] w-full align-baseline rounded-sm" />
            : value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </span>
      {delta != null && (
        <span className="flex items-center">
          {/* La tuile haute donne sa propre ligne a la variation : aucun
              chiffre a cote, donc rien a mettre en exposant. */}
          <Delta value={delta} unit={deltaUnit} offset={false} />
        </span>
      )}
      {hint && <span className="text-xs text-muted-foreground [&_b]:font-semibold [&_b]:text-success-ink">{hint}</span>}
    </Comp>
  );
}
