import * as React from 'react';
import { cn } from '../utils/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui';

/**
 * Tooltip « riche » (contenu large) — peau popover Signature : panneau
 * hairline `--line`, r12, `--shadow-pop` (les tokens gèrent le dark mode).
 * Pour les tooltips texte courts, le TooltipContent nu du kit (encre/fond
 * inversés) suffit — ce composant est réservé aux contenus composés.
 */

/** Placements MUI conservés pour ne pas changer le contrat des appelants. */
type Placement =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end';

export interface ThemedTooltipProps {
  title: React.ReactNode;
  children: React.ReactElement;
  placement?: Placement;
  /**
   * Accepté pour compatibilité d'appel : le TooltipContent du kit porte
   * toujours sa flèche, il n'y a rien à activer.
   */
  arrow?: boolean;
  className?: string;
}

export default function ThemedTooltip({
  title,
  children,
  placement = 'top',
  className,
}: ThemedTooltipProps): React.ReactElement {
  if (!title) return children;

  const [rawSide, edge] = placement.split('-');
  const side = rawSide as 'top' | 'right' | 'bottom' | 'left';
  const align = edge === 'start' ? 'start' : edge === 'end' ? 'end' : 'center';

  return (
    <Tooltip>
      {/* Le declencheur pose une ref sur son enfant, que les composants du kit
          (fonctions sans forwardRef sous React 18) ne transmettent pas : sans le
          span, rien ne s'ancre. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={6}
        className={cn(
          // `[&>svg]` vise la fleche Radix, seul svg enfant direct du contenu.
          'max-w-[360px] rounded-[12px] border border-solid border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[11.5px] font-medium text-[var(--body)] shadow-[var(--shadow-pop)] [&>svg]:fill-[var(--card)]',
          className,
        )}
      >
        {title}
      </TooltipContent>
    </Tooltip>
  );
}
