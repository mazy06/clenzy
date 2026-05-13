import React from 'react';
import { Chip } from '@mui/material';
import type { ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_SOURCE_LABELS,
} from '../../services/api/reservationsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { CheckCircle, AccessTime, ArrowForward, ArrowBack, Cancel } from '../../icons';

// ─── Source colors ───────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<ReservationSource, string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  direct: '#4A9B8E',
  other: '#9e9e9e',
};

// ─── Status icons (accessibility : color-only fix) ───────────────────────────

// Lucide icons : on caste en React.FC compatible avec size/strokeWidth.
type IconComponent = React.FC<{ size?: number; strokeWidth?: number }>;
const STATUS_ICONS: Record<ReservationStatus, IconComponent> = {
  confirmed:    CheckCircle as unknown as IconComponent,
  pending:      AccessTime as unknown as IconComponent,
  checked_in:   ArrowForward as unknown as IconComponent,
  checked_out:  ArrowBack as unknown as IconComponent,
  cancelled:    Cancel as unknown as IconComponent,
};

// ─── Status Chip ─────────────────────────────────────────────────────────────

interface StatusChipProps {
  status: ReservationStatus;
}

export const ReservationStatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const { t } = useTranslation();
  const color = RESERVATION_STATUS_COLORS[status] ?? '#757575';
  const label = t(`reservations.status.${status}`) as string;
  const Icon = STATUS_ICONS[status];

  return (
    <Chip
      icon={Icon ? <Icon size={10} strokeWidth={2} /> : undefined}
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
        '& .MuiChip-icon': {
          color,
          marginLeft: 0.5,
          marginRight: -0.25,
        },
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
