import React from 'react';
import { Box, Chip } from '@mui/material';
import type { ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import { RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import {
  RESERVATION_STATUS_TOKEN_COLORS,
  PLANNING_DEPARTURE_VIOLET,
} from '../planning/constants';
import { getSourceLogo } from '../planning/utils/sourceLogos';
import { useTranslation } from '../../hooks/useTranslation';

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

/** Pilule soft : fond doux + texte couleur (rayon/typo portés par le thème). */
const chipSx = (bg: string, color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  backgroundColor: bg,
  color,
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  '& .MuiChip-label': { px: 1 },
});

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
    <Chip
      icon={
        <Box
          component="span"
          sx={{ width: 9, height: 9, borderRadius: '3px', backgroundColor: color, flexShrink: 0 }}
        />
      }
      label={label}
      size="small"
      sx={{
        ...chipSx(soft, color),
        '& .MuiChip-icon': { ml: 1, mr: -0.5 },
      }}
    />
  );
};

// ─── Source Badge : pastille canal (logo + tokens de canal) ──────────────────

/** Tokens de canal (airbnb / booking / direct), repli neutre — pattern planning. */
function getChannelChipTokens(source: string): { bg: string; color: string } {
  switch (source) {
    case 'airbnb': return { bg: 'var(--airbnb-soft)', color: 'var(--airbnb-ink)' };
    case 'booking': return { bg: 'var(--booking-soft)', color: 'var(--booking-ink)' };
    case 'direct': return { bg: 'var(--direct-soft)', color: 'var(--direct-ink)' };
    default: return { bg: 'var(--field)', color: 'var(--muted)' };
  }
}

interface SourceBadgeProps {
  source: ReservationSource;
}

export const ReservationSourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  const tokens = getChannelChipTokens(source);
  const label = RESERVATION_SOURCE_LABELS[source] ?? source;
  const logo = getSourceLogo(source);

  return (
    <Chip
      icon={
        logo ? (
          <Box
            component="img"
            src={logo}
            alt=""
            sx={{ width: 13, height: 13, objectFit: 'contain', display: 'block' }}
          />
        ) : undefined
      }
      label={label}
      size="small"
      sx={{
        ...chipSx(tokens.bg, tokens.color),
        '& .MuiChip-icon': { ml: 1, mr: -0.5 },
      }}
    />
  );
};
