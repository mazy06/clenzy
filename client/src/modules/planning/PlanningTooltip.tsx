import React from 'react';
import { cn } from '../../utils/cn';
import { TooltipContent } from '../../components/ui';

/**
 * Infobulle du planning : le contenu shadcn, repeint sur la surface du theme.
 *
 * <p>Le primitive peint `bg-foreground / text-background` — une bulle noire en
 * theme clair, blanche en theme sombre. Toutes les infobulles de l'ecran
 * passent par ici pour porter `.pl-tip` (planningUrgency.css), qui les ramene
 * a la carte du theme courant. La bulle etant portalisee dans `<body>`, elle
 * n'a aucun ancetre planning : la classe est le seul rattachement possible.</p>
 */
export const PlanningTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipContent>,
  React.ComponentProps<typeof TooltipContent>
>(function PlanningTooltipContent({ className, ...props }, ref) {
  return <TooltipContent ref={ref} className={cn('pl-tip', className)} {...props} />;
});

export default PlanningTooltipContent;
