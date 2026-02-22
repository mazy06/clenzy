import React from 'react';
import { Chip } from '@mui/material';
import type { ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_SOURCE_LABELS,
} from '../../services/api/reservationsApi';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Source colors ───────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<ReservationSource, string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  direct: '#4A9B8E',
  other: '#9e9e9e',
};

// ─── Status Chip ─────────────────────────────────────────────────────────────

interface StatusChipProps {
  status: ReservationStatus;
}

export const ReservationStatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const { t } = useTranslation();
  const color = RESERVATION_STATUS_COLORS[status] ?? '#757575';
  const label = t(`reservations.status.${status}`) as string;

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: `${color}18`,
        color,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24,
        borderRadius: '6px',
        border: `1px solid ${color}40`,
      }}
    />
  );
};

// ─── Source Badge ─────────────────────────────────────────────────────────────

interface SourceBadgeProps {
  source: ReservationSource;
}

export const ReservationSourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  const color = SOURCE_COLORS[source] ?? '#9e9e9e';
  const label = RESERVATION_SOURCE_LABELS[source] ?? source;

  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      sx={{
        color,
        borderColor: `${color}60`,
        fontWeight: 500,
        fontSize: '0.72rem',
        height: 22,
        borderRadius: '6px',
      }}
    />
  );
};
