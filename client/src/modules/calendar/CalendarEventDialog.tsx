import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { Intervention } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import {
  INTERVENTION_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../types/statusEnums';
import { getTypeLabel } from '../interventions/interventionUtils';
import { semanticToHex } from '../../utils/statusUtils';
import type { ChipColor } from '../../types';

// ─── Chips soft (pilule fond -soft + texte couleur — pattern baseline §2) ────

const pillSx = (bg: string, color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  backgroundColor: bg,
  color,
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  '& .MuiChip-label': { px: 1 },
});

/** Couleur sémantique MUI → pilule soft (primary = accent thémable). */
const chipColorSx = (color: ChipColor) => {
  if (color === 'primary') return pillSx('var(--accent-soft)', 'var(--accent)');
  if (color === 'default') return pillSx('var(--field)', 'var(--muted)');
  const hex = semanticToHex(color);
  return pillSx(`${hex}1F`, hex);
};

interface CalendarEventDialogProps {
  open: boolean;
  onClose: () => void;
  intervention: Intervention | null;
}

const getStatusChipColor = (status: string): ChipColor => {
  const option = INTERVENTION_STATUS_OPTIONS.find(opt => opt.value === status);
  return (option?.color as ChipColor) || 'default';
};

const getStatusLabel = (status: string): string => {
  const option = INTERVENTION_STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.label || status;
};

const getPriorityChipColor = (priority: string): ChipColor => {
  const option = PRIORITY_OPTIONS.find(opt => opt.value === priority);
  return (option?.color as ChipColor) || 'default';
};

const getPriorityLabel = (priority: string): string => {
  const option = PRIORITY_OPTIONS.find(opt => opt.value === priority);
  return option?.label || priority;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  if (hours === 1) return '1 heure';
  return `${hours} heures`;
};

const CalendarEventDialog: React.FC<CalendarEventDialogProps> = ({
  open,
  onClose,
  intervention,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!intervention) return null;

  const handleViewDetails = () => {
    onClose();
    navigate(`/interventions/${intervention.id}`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {/* Titre display + filets : portés par le thème global */}
      <DialogTitle>{intervention.title}</DialogTitle>

      <DialogContent sx={{ pt: '16px !important' }}>
        {/* Chips: Status, Priority, Type — pilules soft (jamais d'aplat plein) */}
        <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
          <Chip
            label={getStatusLabel(intervention.status)}
            size="small"
            sx={chipColorSx(getStatusChipColor(intervention.status))}
          />
          <Chip
            label={getPriorityLabel(intervention.priority)}
            size="small"
            sx={chipColorSx(getPriorityChipColor(intervention.priority))}
          />
          <Chip
            label={getTypeLabel(intervention.type, t)}
            size="small"
            sx={chipColorSx('primary')}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Property */}
        <Box display="flex" alignItems="center" mb={1.5}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><LocationIcon size={18} strokeWidth={1.75} /></Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {intervention.propertyName}
            </Typography>
            {intervention.propertyAddress && (
              <Typography variant="caption" color="text.secondary">
                {intervention.propertyAddress}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Scheduled date */}
        <Box display="flex" alignItems="center" mb={1.5}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><CalendarIcon size={18} strokeWidth={1.75} /></Box>
          <Typography variant="body2">
            {formatDate(intervention.scheduledDate)}
          </Typography>
        </Box>

        {/* Duration */}
        <Box display="flex" alignItems="center" mb={1.5}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><ScheduleIcon size={18} strokeWidth={1.75} /></Box>
          <Typography variant="body2">
            {formatDuration(intervention.estimatedDurationHours)}
          </Typography>
        </Box>

        {/* Assigned to */}
        {intervention.assignedToName && (
          <Box display="flex" alignItems="center" mb={1.5}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1 }}><PersonIcon size={18} strokeWidth={1.75} /></Box>
            <Typography variant="body2">
              {intervention.assignedToName}
            </Typography>
          </Box>
        )}

        {/* Description */}
        {intervention.description && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Box display="flex" alignItems="flex-start" mb={1}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 1, mt: 0.25 }}><AssignmentIcon size={18} strokeWidth={1.75} /></Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {intervention.description}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} size="small">
          Fermer
        </Button>
        <Button variant="contained" onClick={handleViewDetails} size="small">
          Voir les details
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CalendarEventDialog;
