import React from 'react';
import { channelLogo } from '../channelLogos';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

/**
 * Marque d'un canal : le logo OFFICIEL quand la marque en a un, posé sur une
 * pastille neutre, suivi de son nom.
 *
 * <p>La pastille reste couleur carte plutôt que teintée aux couleurs de la
 * marque : c'est le logo qui porte le rouge d'Airbnb ou le bleu de Booking, et
 * un aplat de marque sous un logo de marque brouille les deux.</p>
 *
 * <p>Le libellé vient de {@code reservations.source.*}, le vocabulaire déjà
 * traduit des canaux. Un canal absent de ce vocabulaire (ICAL, OTHER…) se
 * rabat sur son propre nom, remis en casse lisible — jamais crié en capitales.</p>
 */
export interface ChannelTagProps {
  /** Canal, dans n'importe quelle casse (`AIRBNB`, `airbnb`, `hotels_com`…). */
  channel: string;
  className?: string;
}

export default function ChannelTag({ channel, className }: ChannelTagProps) {
  const { t } = useTranslation();
  const key = channel.toLowerCase();
  const logo = channelLogo(key);
  const fallback = key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const label = t(`reservations.source.${key}`, fallback);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card py-1 ps-1 pe-2.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      {logo ? (
        <img src={logo} alt="" className="size-4.5 shrink-0 rounded-full object-cover" />
      ) : null}
      <span className={logo ? undefined : 'ps-1.5'}>{label}</span>
    </span>
  );
}
