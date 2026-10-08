import { useState } from 'react';
import type { IconComponent } from '../icons/glyphs';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import './statusIcon.css';

export type StatusIconTone = 'success' | 'warning' | 'destructive' | 'info' | 'muted';

/** Statut commun aux documents et à Finance, consultable au clavier et au toucher. */
export default function StatusIcon({ icon: Icon, tone, label, className = '' }: {
  icon: IconComponent; tone: StatusIconTone; label: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
    <TooltipTrigger asChild>
      <button type="button" className={`baitly-status-icon ${className}`} data-tone={tone} aria-label={label}
        onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-72 text-xs">{label}</TooltipContent>
  </Tooltip>;
}
