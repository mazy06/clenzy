import * as React from 'react';
import { Badge } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/StatusChip.tsx (MUI), construit sur Badge.
 * Tons sémantiques mappés sur les tokens --bui-* ; couleur arbitraire via
 * color-mix ; pastille `dot` ou icône custom.
 */
export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'accent' | 'neutral';

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'bg-success-soft text-success border-transparent',
  warn: 'bg-warning-soft text-warning border-transparent',
  err: 'bg-destructive-soft text-destructive border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  accent: 'bg-primary-soft text-primary border-transparent',
  neutral: 'bg-muted text-muted-foreground border-transparent',
};

export interface StatusChipProps {
  tone?: StatusTone;
  /** Couleur arbitraire (hex/var) → fond pastel color-mix. Override `tone`. */
  color?: string;
  label: React.ReactNode;
  size?: 'sm' | 'md';
  /** Pastille carrée colorée en tête (au lieu d'une icône). */
  dot?: boolean;
  /** Icône custom (ex. logo canal). Prioritaire sur `dot`. */
  icon?: React.ReactElement;
  className?: string;
}

export default function StatusChip({
  tone = 'neutral',
  color,
  label,
  size = 'md',
  dot = false,
  icon,
  className,
}: StatusChipProps) {
  return (
    <Badge
      variant="secondary"
      style={
        color
          ? {
              backgroundColor: `color-mix(in srgb, ${color} var(--bui-tint-bg, 14%), transparent)`,
              color: `color-mix(in srgb, ${color} var(--bui-tint-text, 82%), var(--bui-ink))`,
            }
          : undefined
      }
      className={cn(
        !color && TONE_CLASSES[tone],
        size === 'sm' && 'px-1.5 py-0 text-2xs',
        className
      )}
    >
      {icon ?? (dot && <span className="size-1.5 rounded-[3px] bg-current" />)}
      {label}
    </Badge>
  );
}
