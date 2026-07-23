import { CircleHelpIcon } from 'lucide-react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../ui';
import type { HelpStep } from './HelpBanner';

/**
 * Baitly — remaster de components/HelpPopover.tsx (MUI), construit sur
 * Popover : aide contextuelle compacte derrière un bouton « ? ».
 */
export interface HelpPopoverProps {
  title: string;
  description: string;
  steps?: HelpStep[];
  /** Libellé du déclencheur (défaut : icône seule). */
  label?: string;
}

export default function HelpPopover({ title, description, steps, label }: HelpPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {label ? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <CircleHelpIcon /> {label}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={title} className="text-muted-foreground">
            <CircleHelpIcon />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        {steps && steps.length > 0 && (
          <div className="mt-3 flex flex-col gap-2.5">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-primary [&>svg]:size-3">
                  {step.icon}
                </span>
                <div className="min-w-0 text-xs">
                  <span className="font-semibold text-foreground">{step.title}</span>{' '}
                  <span className="text-muted-foreground">{step.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
