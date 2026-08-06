import React, { useState } from 'react';
import { cn } from '../utils/cn';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  buttonVariants,
} from './ui';
import { Info as InfoIcon } from '../icons';
import { HelpStepsGrid, type HelpStep } from './HelpBanner';

interface HelpPopoverProps {
  title: string;
  description: string;
  steps?: HelpStep[];
  /** Libellé accessible du bouton (tooltip + aria-label). */
  label?: string;
}

/**
 * Déclencheur d'aide contextuelle — icône ⓘ discrète qui, au clic, ouvre un
 * popover portant le même contenu qu'un {@link HelpBanner} (chip AIDE + titre +
 * description + étapes). Remplace le bandeau permanent : l'aide ne mange plus
 * d'espace vertical mais reste accessible à la demande, sans état "dismissed" à
 * persister.
 *
 * Placement type : porté dans le slot actions du PageHeader d'une page
 * multi-onglets (via {@link usePageHeaderActions}) ou dans les actions d'un
 * header custom (ex. SyncAdmin) — un ⓘ par onglet, à côté du titre.
 *
 * <h2>Design rules appliquées</h2>
 * <ul>
 *   <li>Icône Lucide (pas d'emoji), `cursor: pointer`, focus clavier visible.</li>
 *   <li>Popover : filet 1 px en haut (accent), soft brand wash — pas de
 *   glassmorphism ni de side-stripe.</li>
 *   <li>Étapes en colonne unique (lecture verticale) via {@link HelpStepsGrid}.</li>
 *   <li>`prefers-reduced-motion` respecté par la transition du kit.</li>
 * </ul>
 */
const HelpPopover: React.FC<HelpPopoverProps> = ({
  title,
  description,
  steps = [],
  label = 'Aide',
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        {/* span d'ancrage : PopoverTrigger est une fonction du kit, elle ne
            transmet pas la ref DOM que TooltipTrigger asChild lui poserait. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger
              aria-label={label}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                'cursor-pointer rounded-[9px] text-faint transition-colors duration-150',
                'hover:text-primary hover:bg-primary-soft',
                'motion-reduce:transition-none',
                open && 'text-primary bg-primary-soft',
              )}
            >
              <InfoIcon size={18} strokeWidth={1.75} />
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <PopoverContent
        role="dialog"
        aria-label={title}
        side="bottom"
        align="end"
        sideOffset={4}
        // Filet 1 px en haut (accent) — seul filet autorise, pas un side-stripe.
        className={cn(
          'relative overflow-hidden rounded-[14px] border border-solid border-border bg-card',
          'w-[calc(100vw-32px)] max-w-[460px] min-[600px]:w-[420px]',
          'p-[10.5px] min-[600px]:p-[13.5px]',
          "before:content-[''] before:absolute before:top-0 before:inset-x-0 before:h-px before:bg-primary before:opacity-50",
        )}
        // Le lavis et l'ombre sont des couleurs composees (color-mix) : elles restent
        // en CSS et passent par les variables Baitly UI, pas par des utilities.
        style={{
          backgroundImage:
            'radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--bui-primary) 4%, transparent) 0%, transparent 60%)',
          boxShadow: '0 12px 32px -8px color-mix(in srgb, var(--bui-ink) 22%, transparent)',
        }}
      >
        {/* Header — chip AIDE + titre */}
        <div className="flex items-start gap-1.5 mb-1">
          <div className="text-[10.5px] font-bold tracking-[.06em] uppercase text-primary bg-primary-soft border border-solid border-primary/25 rounded-[8px] px-[4.5px] py-[1.5px] mt-[1.5px] shrink-0 leading-[1.2]" aria-hidden>
            AIDE
          </div>
          <p className="m-0 [font-family:var(--font-display)] text-[15px] font-semibold text-foreground leading-[1.3] tracking-[-.01em] flex-1 text-balance">
            {title}
          </p>
        </div>

        {/* Description */}
        <p className={cn('m-0 text-[12.5px] text-muted-foreground leading-[1.55]', steps.length > 0 ? 'mb-3' : 'mb-0')}>
          {description}
        </p>

        {/* Étapes — colonne unique pour une lecture verticale dans le popover */}
        <HelpStepsGrid steps={steps} columns={1} />
      </PopoverContent>
    </Popover>
  );
};

export default HelpPopover;
