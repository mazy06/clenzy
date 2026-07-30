import * as React from 'react';
import { Badge } from './ui';
import { cn } from '../utils/cn';

/**
 * Pastille de compteur de la navigation Baitly.
 *
 * C'est une simple façade sur le **`Badge` du kit Baitly UI** (`components/ui`) :
 * le rendu — hauteur 20 px, rayon `rounded-sm`, `text-xs`, variantes de teinte —
 * vient du kit et de lui seul. Le PMS (sidebar, onglets de page) consomme cette
 * façade pour que la pastille de notification soit la MÊME partout et suive
 * automatiquement le kit s'il évolue.
 *
 * Ne pas redéfinir ici une forme ou une couleur : ajouter la variante au kit.
 */

export type NavBadgeTone = 'warning' | 'error' | 'success' | 'info' | 'primary';

/** Teinte de navigation → variante du Badge du kit. */
const BADGE_VARIANT: Record<NavBadgeTone, 'default' | 'destructive' | 'warning' | 'info' | 'success'> =
  {
    primary: 'default',
    error: 'destructive',
    warning: 'warning',
    info: 'info',
    success: 'success',
  };

interface NavCountBadgeProps {
  count?: number | null;
  tone?: NavBadgeTone;
  className?: string;
}

export default function NavCountBadge({ count, tone = 'primary', className }: NavCountBadgeProps) {
  if (count == null || count <= 0) return null;
  return (
    <Badge variant={BADGE_VARIANT[tone]} className={cn('px-1.5 py-0 text-2xs tabular-nums', className)}>
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

/**
 * Aplats PLEINS de la miniature de coin.
 *
 * Les variantes du kit sont des fonds DOUX à encre teintée : parfaites sur une
 * ligne de menu, illisibles une fois réduites à 17 px et posées sur le trait
 * d'une icône. La miniature garde la sémantique de teinte mais en aplat plein.
 *
 * Le fond prend la variante `-ink` et le texte `primary-foreground` : c'est le
 * SEUL couple qui tient dans les deux thèmes, parce que les deux tokens
 * s'inversent ensemble (clair : encre foncée + texte blanc ; sombre : teinte
 * claire + texte bleu nuit). Un `bg-warning text-warning-ink` par exemple
 * disparaîtrait en sombre, où l'encre EST la teinte.
 */
const CORNER_TONE: Record<NavBadgeTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  error: 'bg-destructive-ink text-primary-foreground',
  warning: 'bg-warning-ink text-primary-foreground',
  info: 'bg-info-ink text-primary-foreground',
  success: 'bg-success-ink text-primary-foreground',
};

/**
 * Variante « coin d'icône » pour la sidebar REPLIÉE : pastille minimaliste de
 * 14 px ancrée en haut de l'icône, cerclée d'un filet du fond de la sidebar
 * pour se détacher du glyphe sans l'alourdir.
 *
 * On garde le CHIFFRE (et non un simple point) : replier la sidebar ne doit pas
 * coûter l'information. Au-delà de 99 la pastille passe à « 99+ » et s'élargit.
 */
export function NavCornerCountBadge({ count, tone = 'primary', className }: NavCountBadgeProps) {
  if (count == null || count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        // Ancrage à 5 px : le bouton de menu replié est en `overflow-hidden`
        // avec 8 px de padding — au-delà, la pastille serait rognée.
        'pointer-events-none absolute -top-[5px] -end-[5px] inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] text-[9px] font-bold leading-none tabular-nums ring-[1.5px] ring-sidebar',
        CORNER_TONE[tone],
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
