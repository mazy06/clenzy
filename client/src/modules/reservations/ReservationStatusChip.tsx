import React from 'react';
import type { ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import { RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import {
  RESERVATION_STATUS_TOKEN_COLORS,
  PLANNING_DEPARTURE_VIOLET,
} from '../planning/constants';
import { getSourceLogo } from '../planning/utils/sourceLogos';
import { getChannelChipTokens } from '../../utils/channelChipTokens';
import { useTranslation } from '../../hooks/useTranslation';
import StatusChip from '../../components/StatusChip';

// ─── Statuts : couleurs VALIDÉES planning (constantes locales planning) ──────
//
// Texte couleur + fond `-soft` (pattern chips statut du PanelReservationInfo).
// Annulée = fantôme neutre (--hover / --muted), cohérent avec la brique hachurée.

const STATUS_SOFT: Record<string, string> = {
  confirmed: 'var(--ok-soft)',
  pending: 'var(--warn-soft)',
  checked_in: 'var(--info-soft)',
  checked_out: `${PLANNING_DEPARTURE_VIOLET}1F`,
  cancelled: 'var(--hover)',
};

// ─── Status Chip ─────────────────────────────────────────────────────────────

interface StatusChipProps {
  status: ReservationStatus;
}

export const ReservationStatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const { t } = useTranslation();
  const color =
    status === 'cancelled'
      ? 'var(--muted)'
      : RESERVATION_STATUS_TOKEN_COLORS[status] ?? 'var(--muted)';
  const soft = STATUS_SOFT[status] ?? 'var(--hover)';
  const label = t(`reservations.status.${status}`) as string;

  return (
    <StatusChip
      pill
      tokens={{ color, bg: soft }}
      label={label}
      icon={
        <span
          aria-hidden
          className="size-[9px] shrink-0 rounded-[3px]"
          style={{ backgroundColor: color }}
        />
      }
    />
  );
};

// ─── Source Badge : pastille canal (logo + tokens de canal) ──────────────────

/** Tokens de canal (airbnb / booking / direct), repli neutre — pattern planning. */
interface SourceBadgeProps {
  source: ReservationSource;
}

export const ReservationSourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  const tokens = getChannelChipTokens(source);
  const label = RESERVATION_SOURCE_LABELS[source] ?? source;
  const logo = getSourceLogo(source);

  return (
    <StatusChip
      pill
      tokens={tokens}
      label={label}
      icon={
        logo ? (
          <img className="block size-[13px] object-contain" src={logo} alt="" />
        ) : undefined
      }
    />
  );
};
