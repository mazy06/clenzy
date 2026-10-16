import type { ReactNode } from 'react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { cn } from '../../utils/cn';

// Contour neutre, ou de marque pour les créations (jamais d'aplat plein).
const BASE = 'rounded-md border border-solid transition-colors duration-150 cursor-pointer';
const NEUTRAL = 'border-border text-muted-foreground hover:bg-muted hover:text-foreground';
const ACCENT = 'border-primary text-primary hover:bg-primary-soft';

/** Bouton-icône d'action du PageHeader, avec son infobulle. */
export default function HeaderIconButton({ label, onClick, disabled, accent, children }: {
  label: string; onClick: () => void; disabled?: boolean; accent?: boolean; children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span : un bouton désactivé n'émet pas de survol, et le Button du kit ne transmet pas de ref. */}
        <span className="inline-flex">
          <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled}
            className={cn(BASE, accent ? ACCENT : NEUTRAL)}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
