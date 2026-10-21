import React from 'react';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import ChannelMark from './ChannelMark';
import './baitly-conversation-avatar.css';

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
 * Avatar d'une conversation : photo ou initiales pour une personne, pictogramme
 * bleu pour l'équipe et turquoise pour un formulaire. Les canaux externes
 * conservent leur marque, les échanges internes évitent une seconde pastille.
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
    <span className="baitly-conversation-avatar relative inline-flex shrink-0" data-kind={channel === 'FORM' ? 'form' : channel === 'INTERNAL' ? 'internal' : 'guest'}>
      {group || channel === 'FORM' ? (
        <span
          className="baitly-conversation-symbol"
          style={{ width: size, height: size }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {channel === 'FORM' ? <>
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
              <path d="M14 3v6h6M8 13h8M8 17h5" />
            </> : <>
              <circle cx="9" cy="8" r="3" />
              <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" />
            </>}
          </svg>
        </span>
      ) : (
        <GuestAvatar name={name} photoUrl={photoUrl} size={size} />
      )}
      {channel !== 'INTERNAL' && channel !== 'FORM' && <ChannelMark
        channel={channel}
        size={Math.max(20, Math.round(size * 0.55))}
        ring
        className="baitly-conversation-channel absolute"
      />}
    </span>
  );
}
