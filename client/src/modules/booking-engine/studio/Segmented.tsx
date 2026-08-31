import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { cn } from '../../../utils/cn';

/**
 * Groupe segmenté du Studio — un choix parmi n, rendu en icônes ou en libellés
 * très courts.
 *
 * <p>C'est le gabarit du commutateur de rendu (Bureau / Tablette / Mobile) de la
 * barre du haut, extrait ici pour que la barre de langues (FR / EN / AR) le
 * PARTAGE au lieu de le réimplémenter. Deux copies auraient divergé au premier
 * ajustement — et la langue active, dessinée en aplat sombre, se lisait déjà
 * comme un autre objet que le rendu actif, dessiné en carte claire.</p>
 *
 * <p>Le libellé n'est jamais rendu : il part en `aria-label` et en infobulle.
 * Un segment fait 30 px de large — de quoi porter une icône ou deux ou trois
 * caractères, pas un mot.</p>
 */
export function Segmented({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-lg bg-field p-0.5" role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function SegmentedItem({
  active,
  label,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  /** Sens du segment : infobulle ET `aria-label`, puisque rien n'est écrit. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'inline-flex h-7 min-w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-md px-1',
            'text-2xs font-semibold tracking-wide transition-colors duration-150 ease-out-quart',
            'hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none',
            active ? 'bg-card text-primary shadow-sm' : 'bg-transparent text-muted-foreground',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
