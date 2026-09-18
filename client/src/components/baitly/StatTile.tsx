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
interface StatTileBaseProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
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

/**
 * Ton de la tuile — ORDINAIRE ou PORTANTE, jamais les deux à la fois.
 *
 * <h2>Tuile PORTANTE ({@code feature})</h2>
 * <p>L'unique moment engagé de l'écran. Le reste de l'application est en
 * neutre ; une rangée de tuiles identiques ne dit pas où regarder. Une seule
 * tuile par écran prend la teinte de l'accent, et le choix de LAQUELLE est une
 * décision métier, pas un réglage. Deux tuiles portantes sur un écran, et il
 * n'y en a plus aucune.</p>
 *
 * <p>La teinte est {@code --accent}, donc celle que l'utilisateur a choisie via
 * {@code data-accent} : elle suit sa préférence au lieu de l'ignorer.</p>
 *
 * <p>Elle porte le FOND, le FILET et l'ICÔNE — jamais le texte. La teinte vive
 * en texte plafonne sous l'AA sur son propre fond pastel pour 7 des 8 teintes
 * sélectionnables (mesuré : 2,62 à 4,96 ; seul l'indigo passe). Le filet et
 * l'icône utilisent {@code --accent-deep}, qui tient le seuil 3:1 des éléments
 * non textuels sur les huit — pire cas <b>3,16, l'indigo en SOMBRE</b> ; le
 * clair est plus confortable (3,46 au pire, l'ambre). C'est donc le mode sombre
 * qui contraint cette teinte, pas le clair.</p>
 *
 * <p>Le LIBELLÉ passe à l'encre pleine plutôt qu'à l'encre secondaire :
 * celle-ci tombe à 4,49 sur un fond indigo posé sur une carte, et à 4,30 posé
 * sur la page — où elle échoue d'ailleurs pour les huit teintes (4,30 à 4,51).
 * L'encre pleine y tient 9,48 au minimum (indigo sombre), et le libellé d'une
 * tuile portante mérite de toute façon d'être lu.</p>
 *
 * <h2>Ce qu'une tuile portante accepte encore sur son icône</h2>
 * <p>{@code iconClassName} et {@code feature} visaient tous deux l'icône, et
 * l'appelant gagnait sans le dire : passer les deux gardait le fond et le filet
 * d'accent mais remplaçait silencieusement l'icône d'accent.</p>
 *
 * <p>Ce qui échoue n'est pourtant pas « porter un état sur une tuile portante »
 * — c'est la TEINTE VIVE. Mesuré sur le fond d'accent, les huit teintes
 * sélectionnables et les deux thèmes : une icône vive rend 2,11 à 2,21:1 en
 * clair, sous le seuil 3:1 des éléments non textuels (le sombre masque le
 * défaut, vive et encre y étant confondues). Les encres {@code -ink}, elles,
 * tiennent 4,98 à 5,22 en clair et 6,73 à 7,06 en sombre.</p>
 *
 * <p>D'où la règle que ce type impose : sur une tuile portante l'icône peut
 * encore dire un état, mais seulement en {@code -ink}. Une tuile qui affiche
 * « À valider » a besoin de distinguer « il reste du travail » de « plus rien »,
 * et l'accent ne sait pas dire cela ; lui interdire toute sémantique aurait
 * supprimé une information réelle. Le compilateur écarte la teinte vive, il
 * n'écarte pas le sens.</p>
 *
 * <p>Corollaire : une teinte CONSTANTE sur une tuile portante ne dit rien que
 * l'accent ne dise déjà — elle se retire plutôt qu'elle ne se convertit.</p>
 */
type StatTileToneProps =
  | {
      feature?: false;
      /** Classe de couleur de l'icône (ex. 'text-success'). Défaut : primaire. */
      iconClassName?: string;
    }
  | {
      feature: true;
      /**
       * Sur une tuile portante : encres {@code -ink} uniquement. La teinte vive
       * tombe à ~2,2:1 sur le fond d'accent — cf. l'en-tête de ce type.
       */
      iconClassName?: `text-${string}-ink`;
    };

export type StatTileProps = StatTileBaseProps & StatTileToneProps;

export default function StatTile({
  icon,
  label,
  value,
  unit,
  iconClassName,
  feature = false,
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
          // La pastille compacte a deja la geometrie d'une boite : elle peut
          // donc porter le fond, alors qu'une ligne de base nue ne le pourrait
          // pas. C'est la seule forme visible dans le produit — toutes les
          // rangees de tuiles y sont `compact`.
          feature && 'bg-[var(--accent-soft)]',
          onClick &&
            'cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
          onClick && (feature ? 'hover:brightness-[0.97]' : 'hover:bg-accent'),
          className,
        )}
      >
        <span
          className={cn(
            'inline-flex shrink-0 self-center [&>svg]:size-3.5',
            // Sur une ligne de base, un fond n'a pas sa place : seule l'icône
            // peut porter la teinte.
            iconClassName ?? (feature ? 'text-[var(--accent-deep)]' : 'text-primary'),
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
        <span className={cn('text-xs', feature ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
      </Comp>
    );
  }

  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-1 rounded-xl border p-4 text-start',
        feature
          ? 'border-[var(--accent-deep)] bg-[var(--accent-soft)]'
          : 'border-border bg-card',
        onClick &&
          'cursor-pointer transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        // Le survol neutre effacerait la teinte de la tuile portante.
        onClick && (feature ? 'hover:brightness-[0.97]' : 'hover:bg-accent'),
        className
      )}
    >
      <span className={cn('flex min-w-0 items-center gap-1.5 text-xs font-medium',
        feature ? 'text-foreground' : 'text-muted-foreground')}>
        <span className={cn('inline-flex shrink-0 [&>svg]:size-3.5',
          iconClassName ?? (feature ? 'text-[var(--accent-deep)]' : 'text-primary'))}>
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
