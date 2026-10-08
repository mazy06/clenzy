/**
 * Marque d'origine d'une conversation : le logo OFFICIEL de la marque quand
 * elle en a un (Airbnb, Booking.com, WhatsApp), sinon un glyphe sur pastille
 * teintée.
 *
 * <p>Une conversation de la messagerie unifiée arrive d'un canal — un logo de
 * marque le dit immédiatement, là où un glyphe générique demandait de lire le
 * sous-titre. Les logos viennent du registre partagé
 * {@code components/channelLogos.ts} : un canal ajouté là-bas apparaît ici.</p>
 */

import React from 'react';
import { CHANNEL_LOGOS } from '../../../components/channelLogos';
import { MARK_VIEWBOX } from '../../../components/BaitlyMarkLogo';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  Assignment as FormIcon,
  Chat as ChatIcon,
} from '../../../icons';
import { cn } from '../../../utils/cn';

type GlyphIcon = React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;

/** Canal de conversation → clé du registre de logos partagé. */
const BRAND_LOGO_KEYS: Record<string, string> = {
  AIRBNB: 'airbnb',
  BOOKING: 'booking',
  WHATSAPP: 'whatsapp',
};

/**
 * Canaux sans logo de marque : pastille pleine + glyphe blanc.
 *
 * <p>Les teintes sont choisies pour porter du BLANC : les accents pastel de la
 * palette (#7BA3C2, #D4A574) plafonnent sous 3:1 avec du blanc, seuil des
 * éléments non textuels. Email et SMS descendent donc d'un cran, et le
 * formulaire prend le teal foncé — il ne partage plus la couleur de la
 * messagerie interne, avec laquelle il était indistinguable.</p>
 */
const GLYPH_MARKS: Record<string, { color: string; Icon: GlyphIcon }> = {
  EMAIL: { color: '#4A6B9A', Icon: EmailIcon },
  SMS: { color: '#A6763F', Icon: SmsIcon },
  FORM: { color: '#3E8478', Icon: FormIcon },
};

const LABELS: Record<string, string> = {
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking.com',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
  INTERNAL: 'Interne',
  FORM: 'Formulaire',
};

/** Libellé lisible d'un canal (titre de fil, ligne de contexte, infobulle). */
export function channelLabel(channel: string): string {
  return LABELS[channel] ?? channel;
}

/**
 * Contour de la maison du mark Baitly, tiges de flux exclues : à 14 px, le
 * trait de 21/1024 du mark complet disparaît et les deux boucles se réduisent
 * à des taches. Même géométrie (mêmes rayons, même pente de toit), trait épais,
 * plus une porte qui reprend la verticale centrale du flux.
 */
const HOUSE_PATH =
  'M303 675 V441.8 A28 28 0 0 1 313.9 419.6 L478.2 294.1 A54 54 0 0 1 543.8 294.1 ' +
  'L708.1 419.6 A28 28 0 0 1 719 441.8 V675 A65 65 0 0 1 654 740 H368 A65 65 0 0 1 303 675 Z';
const DOOR_PATH = 'M511 740 V600';

export interface ChannelMarkProps {
  /** Valeur de `ConversationChannel` (+ `FORM`, propre à l'inbox unifiée). */
  channel: string;
  /** Diamètre total en px, anneau compris. Défaut 18. */
  size?: number;
  /** Anneau couleur carte — quand la pastille est posée sur un avatar. */
  ring?: boolean;
  className?: string;
}

export default function ChannelMark({ channel, size = 18, ring = false, className }: ChannelMarkProps) {
  const label = channelLabel(channel);
  const inner = ring ? size - 4 : size;
  const shell = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    ring && 'border-2 border-card',
    className,
  );
  const box = { width: size, height: size } as const;

  const logo = CHANNEL_LOGOS[BRAND_LOGO_KEYS[channel] ?? ''];
  if (logo) {
    // Pleine bordure : ces marques sont dessinées comme des pastilles (carré
    // arrondi Airbnb / Booking, disque WhatsApp). Les contenir laisserait un
    // timbre minuscule au centre d'un disque vide.
    return (
      <span className={shell} style={box} title={label}>
        <img src={logo} alt="" className="size-full object-cover" />
      </span>
    );
  }

  if (channel === 'INTERNAL') {
    return (
      <span className={cn(shell, 'bg-primary text-primary-foreground')} style={box} title={label}>
        <svg
          viewBox={MARK_VIEWBOX}
          width={Math.round(inner * 0.72)}
          height={Math.round(inner * 0.72)}
          fill="none"
          stroke="currentColor"
          strokeWidth={64}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={HOUSE_PATH} />
          <path d={DOOR_PATH} />
        </svg>
      </span>
    );
  }

  const glyph = GLYPH_MARKS[channel] ?? { color: '#6B7A85', Icon: ChatIcon };
  return (
    <span
      className={cn(shell, 'text-white')}
      style={{ ...box, backgroundColor: glyph.color }}
      title={label}
    >
      <glyph.Icon size={Math.round(inner * 0.62)} strokeWidth={2.25} />
    </span>
  );
}
