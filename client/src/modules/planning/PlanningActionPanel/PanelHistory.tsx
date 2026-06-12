import React from 'react';
import {
  Box,
  Typography,
} from '@mui/material';
import {
  FlightLand,
  FlightTakeoff,
  AutoAwesome,
  Handyman,
} from '../../../icons';
import type { PlanningEvent } from '../types';
import {
  RESERVATION_STATUS_TOKEN_COLORS,
  PLANNING_DEPARTURE_VIOLET,
  INTERVENTION_TYPE_TOKEN_COLORS,
} from '../constants';

interface PanelHistoryProps {
  event: PlanningEvent;
}

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
};

const PanelHistory: React.FC<PanelHistoryProps> = ({ event }) => {
  const reservation = event.reservation;

  // Build a simple timeline from available data
  const timelineItems: { icon: React.ReactNode; label: string; date: string; color: string }[] = [];

  if (reservation) {
    timelineItems.push({
      icon: <FlightLand size={14} strokeWidth={1.75} />,
      label: 'Check-in',
      date: `${reservation.checkIn}${reservation.checkInTime ? ` ${reservation.checkInTime}` : ''}`,
      color: RESERVATION_STATUS_TOKEN_COLORS.checked_in,
    });
    timelineItems.push({
      icon: <FlightTakeoff size={14} strokeWidth={1.75} />,
      label: 'Check-out',
      date: `${reservation.checkOut}${reservation.checkOutTime ? ` ${reservation.checkOutTime}` : ''}`,
      color: PLANNING_DEPARTURE_VIOLET,
    });
    // Auto-cleaning placeholder
    timelineItems.push({
      icon: <AutoAwesome size={14} strokeWidth={1.75} />,
      label: 'Menage prevu',
      date: reservation.checkOut,
      color: INTERVENTION_TYPE_TOKEN_COLORS.cleaning,
    });
  }

  if (event.intervention) {
    timelineItems.push({
      icon: event.type === 'cleaning'
        ? <AutoAwesome size={14} strokeWidth={1.75} />
        : <Handyman size={14} strokeWidth={1.75} />,
      label: event.intervention.title,
      date: `${event.intervention.startDate}${event.intervention.startTime ? ` ${event.intervention.startTime}` : ''}`,
      color: event.color,
    });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      {/* Stay timeline — lignes hairline + dots tokens */}
      <Box>
        <Typography sx={{ ...OVERLINE_SX, mb: 1 }}>
          Timeline du sejour
        </Typography>
        <Box>
          {timelineItems.map((item, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                py: 1,
                borderBottom: idx < timelineItems.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '3px',
                  backgroundColor: item.color,
                  flexShrink: 0,
                }}
              />
              <Box component="span" sx={{ display: 'inline-flex', color: item.color, flexShrink: 0 }}>
                {item.icon}
              </Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)', flex: 1, minWidth: 0 }} noWrap>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {item.date}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Modification history placeholder */}
      <Box>
        <Typography sx={{ ...OVERLINE_SX, mb: 1 }}>
          Historique des modifications
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          L'historique detaille sera disponible dans une prochaine mise a jour.
        </Typography>
      </Box>
    </Box>
  );
};

export default PanelHistory;
