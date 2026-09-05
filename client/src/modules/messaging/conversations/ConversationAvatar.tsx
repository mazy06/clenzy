import React from 'react';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import { Groups as GroupsIcon } from '../../../icons';
import ChannelMark from './ChannelMark';

export interface ConversationAvatarProps {
  name: string;
  /** Valeur de `ConversationChannel` (+ `FORM`). */
  channel: string;
  /** Fil interne à plusieurs participants : le titre n'est pas un nom de personne. */
  group?: boolean;
  photoUrl?: string | null;
  /** Diamètre de l'avatar en px. Défaut 32. */
  size?: number;
}

/**
 * Avatar d'une conversation : QUI parle (photo, initiales ou pastille de
 * groupe) et D'OÙ ça vient (marque du canal, en pastille).
 *
 * <p>Un fil de groupe n'a pas de nom de personne : ses initiales sortaient du
 * titre, ce qui donnait « [C » pour « [DÉMO] Conversation ». Il porte donc un
 * glyphe de groupe, qui dit aussi ce que les initiales ne disaient pas — que
 * l'échange est collectif.</p>
 */
export default function ConversationAvatar({
  name,
  channel,
  group = false,
  photoUrl,
  size = 32,
}: ConversationAvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      {group ? (
        <span
          className="flex items-center justify-center rounded-full bg-primary-soft text-primary"
          style={{ width: size, height: size }}
        >
          <GroupsIcon size={Math.round(size * 0.5)} strokeWidth={1.75} />
        </span>
      ) : (
        <GuestAvatar name={name} photoUrl={photoUrl} size={size} />
      )}
      <ChannelMark
        channel={channel}
        size={Math.max(14, Math.round(size * 0.56))}
        ring
        className="absolute -bottom-0.5 -end-0.5"
      />
    </span>
  );
}
