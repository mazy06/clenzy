import React, { type CSSProperties } from 'react';
import { cn } from '../../utils/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';

/**
 * Carte d'option selectionnable — pattern moderne pour remplacer les chips
 * empiles, plus visuel et tactile.
 *
 * <p>Etats :
 * <ul>
 *   <li><b>Default</b> : border subtle (divider), bgcolor transparent</li>
 *   <li><b>Hover</b> : border primary.light, bgcolor primary 2%</li>
 *   <li><b>Selected</b> : border primary 1.5px, bgcolor primary 6%, indicateur radio
 *       en haut a droite</li>
 * </ul>
 *
 * <p>La card affiche seulement le {@code label} + indicateur radio pour rester
 * compacte. Les details optionnels ({@code description}, {@code hint}) sont
 * exposes via un {@link Tooltip} au hover/focus — UX moderne et discrete qui
 * libere de la place verticale sans sacrifier l'info.</p>
 *
 * <p>Conformite Baitly / Impeccable : pas de gradient, pas de scale hover,
 * pas de glow shadow. Transitions discretes (150ms). Accessible : role button,
 * aria-pressed, focus-visible ring, Enter/Space keyboard.</p>
 */
export interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  /** Titre principal court (1-3 mots), affiche en permanence sur la card. */
  label: React.ReactNode;
  /** Description secondaire affichee dans le tooltip au hover/focus. */
  description?: React.ReactNode;
  /** Info complementaire (prix, badge…) affichee aussi dans le tooltip. */
  hint?: React.ReactNode;
  /** Couleur d'accent custom (defaut : la primary Baitly). */
  accent?: string;
  disabled?: boolean;
}

export default function OptionCard({
  selected,
  onClick,
  label,
  description,
  hint,
  accent,
  disabled = false,
}: OptionCardProps) {
  const accentColor = accent ?? 'var(--bui-primary)';

  const hasTooltipContent = !!(description || hint);
  const tooltipTitle = hasTooltipContent ? (
    <div className="py-0.5">
      {description && (
        <span className="block text-xs leading-[1.4]">
          {description}
        </span>
      )}
      {hint && (
        <div className={cn(description ? 'mt-[3px]' : 'mt-0')}>{hint}</div>
      )}
    </div>
  ) : null;

  const card = (
    // `accentColor` vient d'une prop ou du theme : valeur runtime, donc portee
    // par la variable CSS `--option-accent` pour rester utilisable dans les
    // classes de survol et de focus (une classe Tailwind ne peut pas naitre
    // d'une variable). `pe-[30px]` reserve la place de l'indicateur radio.
    <div
      role="button"
      aria-pressed={selected}
      aria-label={typeof label === 'string' ? label : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onClick()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ '--option-accent': accentColor } as CSSProperties}
      className={cn(
        'relative flex items-center gap-1.5 py-[9px] ps-3 pe-[30px] min-h-[52px] rounded-[12px]',
        'border-[1.5px] border-solid outline-none',
        'transition-[border-color,background-color] duration-150 ease-[ease] motion-reduce:transition-none',
        'focus-visible:border-[var(--option-accent)]',
        'focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--option-accent)_18%,transparent)]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100',
        selected
          ? cn(
              'border-[var(--option-accent)] bg-[color-mix(in_srgb,var(--option-accent)_6%,transparent)]',
              'hover:bg-[color-mix(in_srgb,var(--option-accent)_8%,transparent)]',
            )
          : cn(
              'border-border bg-transparent',
              'hover:border-[color-mix(in_srgb,var(--option-accent)_50%,transparent)]',
              'hover:bg-[color-mix(in_srgb,var(--option-accent)_2%,transparent)]',
            ),
      )}
    >
      <p className="text-sm font-semibold leading-[1.3] text-foreground flex-1 min-w-0">
        {label}
      </p>

      {/* Indicateur radio en haut a droite */}
      <div
        aria-hidden
        className="absolute top-1/2 end-[14px] -translate-y-1/2 w-4 h-4 rounded-[50%] border-[1.5px] border-solid bg-card flex items-center justify-center"
        style={{
          // accentColor vient d'une prop / du theme : valeur runtime.
          borderColor: selected ? accentColor : 'var(--bui-border)',
          transition: 'border-color 150ms ease',
        }}
      >
        {selected && (
          <div className="w-[8px] h-[8px] rounded-[50%]" style={{ backgroundColor: accentColor }} />
        )}
      </div>
    </div>
  );

  if (!hasTooltipContent) return card;

  return (
    // Le `sx` de l'ancienne infobulle ne faisait que redire le gabarit du
    // primitif (fond sombre, texte clair, petite graisse, rayon) : seule la
    // largeur maximale de 240 px etait un vrai ajout.
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        {tooltipTitle}
      </TooltipContent>
    </Tooltip>
  );
}
