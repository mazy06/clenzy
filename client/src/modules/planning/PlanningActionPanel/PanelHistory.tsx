import React from 'react';
import {
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Timeline,
  FlightLand,
  FlightTakeoff,
  AutoAwesome,
  Handyman,
  CheckCircle,
  History,
} from '../../../icons';
import type { PlanningEvent } from '../types';

interface PanelHistoryProps {
  event: PlanningEvent;
}

const PanelHistory: React.FC<PanelHistoryProps> = ({ event }) => {
  const reservation = event.reservation;

  // Build a simple timeline from available data
  const timelineItems: { icon: React.ReactNode; label: string; date: string; color: string }[] = [];

  if (reservation) {
    timelineItems.push({
      icon: <FlightLand size={16} strokeWidth={1.75} />,
      label: 'Check-in',
      date: `${reservation.checkIn}${reservation.checkInTime ? ` ${reservation.checkInTime}` : ''}`,
      color: '#6B8A9A',
    });
    timelineItems.push({
      icon: <FlightTakeoff size={16} strokeWidth={1.75} />,
      label: 'Check-out',
      date: `${reservation.checkOut}${reservation.checkOutTime ? ` ${reservation.checkOutTime}` : ''}`,
      color: '#757575',
    });
    // Auto-cleaning placeholder
    timelineItems.push({
      icon: <AutoAwesome size={16} strokeWidth={1.75} />,
      label: 'Menage prevu',
      date: reservation.checkOut,
      color: '#9B7FC4',
    });
  }

  if (event.intervention) {
    timelineItems.push({
      icon: event.type === 'cleaning'
        ? <AutoAwesome size={16} strokeWidth={1.75} />
        : <Handyman size={16} strokeWidth={1.75} />,
      label: event.intervention.title,
      date: `${event.intervention.startDate}${event.intervention.startTime ? ` ${event.intervention.startTime}` : ''}`,
      color: event.color,
    });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Stay timeline */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Timeline size={18} strokeWidth={1.75} /></Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
            Timeline du sejour
          </Typography>
        </Box>
        <List dense sx={{ py: 0 }}>
          {timelineItems.map((item, idx) => (
            <ListItem key={idx} sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32, color: item.color }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.date}
                primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: '0.6875rem' }}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider />

      {/* Modification history placeholder */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><History size={18} strokeWidth={1.75} /></Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
            Historique des modifications
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
          L'historique detaille sera disponible dans une prochaine mise a jour.
        </Typography>
      </Box>
    </Box>
  );
};

export default PanelHistory;
