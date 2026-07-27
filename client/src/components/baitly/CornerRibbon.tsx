import * as React from 'react';
import { cn } from '../../utils/cn';

/**
 * Baitly — ruban d'angle diagonal.
 *
 * Signale une offre / une nouveauté sur une carte, sans consommer de place dans
 * le flux de contenu (contrairement à un `Badge` posé dans l'en-tête).
 *
 * Le parent DOIT être `relative` et `overflow-hidden` — sinon le ruban déborde.
 *
 * Usage :
 *   <Card className="relative overflow-hidden">
 *     <CornerRibbon label="-50 %" tone="promo" />
 *     …
 *   </Card>
 */
export type CornerRibbonTone = 'promo' | 'exclusive' | 'new' | 'success';

export interface CornerRibbonProps {
  label: string;
  /** promo = destructif, exclusive = warning, new = info, success = succès. */
  tone?: CornerRibbonTone;
  /** Coin d'ancrage, en logique RTL : 'start' (défaut) ou 'end'. */
  side?: 'start' | 'end';
  className?: string;
}

const TONE_CLASSES: Record<CornerRibbonTone, string> = {
  promo: 'bg-destructive text-destructive-foreground',
  exclusive: 'bg-warning text-ink',
  new: 'bg-info text-primary-foreground',
  success: 'bg-success text-primary-foreground',
};

export default function CornerRibbon({
  label,
  tone = 'promo',
  side = 'start',
  className,
}: CornerRibbonProps) {
  return (
    <span
      aria-hidden={false}
      role="note"
      className={cn(
        'pointer-events-none absolute top-0 z-10 size-24 overflow-hidden',
        side === 'start' ? 'start-0' : 'end-0'
      )}
    >
      <span
        className={cn(
          'absolute top-[18px] w-[136px] py-1 text-center text-[10px] font-semibold tracking-wide uppercase shadow-sm',
          // La bande traverse le coin : on la décale puis on la fait pivoter.
          // La rotation s'inverse en RTL pour rester alignée sur le même coin.
          side === 'start'
            ? '-start-[30px] -rotate-45 rtl:rotate-45'
            : '-end-[30px] rotate-45 rtl:-rotate-45',
          TONE_CLASSES[tone],
          className
        )}
      >
        {label}
      </span>
    </span>
  );
}
