import * as React from 'react';
import { CheckIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — grappe de pastilles de canaux avec état de connexion.
 *
 * Généralisation, avec le kit Baitly UI, de components/settings/OtaSyncBadges.tsx
 * (MUI, couplé aux codes Channex) : ici la primitive est agnostique — elle prend
 * une liste de canaux avec un logo (image ou nœud) et un état connecté.
 *
 * L'état de diffusion multi-canal d'un logement se lit alors d'un coup d'œil,
 * y compris posé sur une photo (`overlay`), sans ouvrir la fiche.
 *
 * Usage :
 *   <ChannelBadges
 *     channels={[
 *       { key: 'airbnb', label: 'Airbnb', logo: airbnbLogo, connected: true },
 *       { key: 'booking', label: 'Booking.com', logo: bookingLogo },
 *     ]}
 *   />
 */
export interface ChannelBadgeItem {
  key: string;
  /** Nom lisible du canal — sert au tooltip et à l'alternative textuelle. */
  label: string;
  /** URL d'un logo (assets/logo/*) OU nœud React (icône, initiale). */
  logo?: string;
  icon?: React.ReactNode;
  connected?: boolean;
  /** Précision ajoutée au tooltip (ex. « synchronisé il y a 5 min »). */
  hint?: string;
}

export interface ChannelBadgesProps {
  channels: ChannelBadgeItem[];
  size?: 'sm' | 'md';
  /**
   * Rendu pour superposition sur un média : fond opaque et ombre portée, afin
   * de rester lisible sur n'importe quelle photo.
   */
  overlay?: boolean;
  /** Au-delà de N canaux, le reste est replié en « +N ». */
  max?: number;
  className?: string;
}

// Classes écrites en toutes lettres : Tailwind extrait les classes
// statiquement, une interpolation `size-${…}` ne serait jamais générée.
const SIZE_CLASSES = {
  sm: {
    badge: 'size-6',
    img: 'size-3.5',
    svg: '[&>svg]:size-3.5',
    check: 'size-3 [&>svg]:size-2',
    text: 'text-[9px]',
  },
  md: {
    badge: 'size-8',
    img: 'size-4.5',
    svg: '[&>svg]:size-4.5',
    check: 'size-3.5 [&>svg]:size-2.5',
    text: 'text-[11px]',
  },
} as const;

export default function ChannelBadges({
  channels,
  size = 'md',
  overlay = false,
  max,
  className,
}: ChannelBadgesProps) {
  const s = SIZE_CLASSES[size];
  const visible = max ? channels.slice(0, max) : channels;
  const hidden = max ? channels.length - visible.length : 0;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {visible.map((channel) => {
        const connected = channel.connected ?? false;
        return (
          <Tooltip key={channel.key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'relative inline-flex shrink-0 items-center justify-center rounded-full border',
                  s.badge,
                  overlay
                    ? 'border-transparent bg-background shadow-sm'
                    : 'border-border bg-card',
                  // Canal non connecté : désaturé et atténué, mais toujours
                  // identifiable — on montre le canal possible, pas un trou.
                  !connected && 'opacity-45 grayscale'
                )}
              >
                {channel.logo ? (
                  <img src={channel.logo} alt="" aria-hidden className={cn('object-contain', s.img)} />
                ) : (
                  <span className={cn('inline-flex text-muted-foreground', s.svg)}>
                    {channel.icon}
                  </span>
                )}
                {connected && (
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -end-0.5 inline-flex items-center justify-center rounded-full bg-success text-primary-foreground ring-2 ring-background',
                      s.check
                    )}
                  >
                    <CheckIcon strokeWidth={3} />
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {channel.label} · {connected ? 'connecté' : 'non connecté'}
              {channel.hint ? ` · ${channel.hint}` : ''}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {hidden > 0 && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full border font-medium text-muted-foreground tabular-nums',
            s.badge,
            s.text,
            overlay ? 'border-transparent bg-background shadow-sm' : 'border-border bg-card'
          )}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}
