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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Intervention } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import {
  INTERVENTION_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../types/statusEnums';
import { getTypeLabel } from '../interventions/interventionUtils';
import type { ChipColor } from '../../types';

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
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600, fontSize: '1rem' }}>
          {intervention.title}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Chips: Status, Priority, Type */}
        <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
          <Chip
            label={getStatusLabel(intervention.status)}
            size="small"
            color={getStatusChipColor(intervention.status)}
            sx={{ fontSize: '0.75rem' }}
          />
          <Chip
            label={getPriorityLabel(intervention.priority)}
            size="small"
            color={getPriorityChipColor(intervention.priority)}
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
          <Chip
            label={getTypeLabel(intervention.type, t)}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Property */}
        <Box display="flex" alignItems="center" mb={1.5}>
          <LocationIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
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
          <CalendarIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
          <Typography variant="body2">
            {formatDate(intervention.scheduledDate)}
          </Typography>
        </Box>

        {/* Duration */}
        <Box display="flex" alignItems="center" mb={1.5}>
          <ScheduleIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
          <Typography variant="body2">
            {formatDuration(intervention.estimatedDurationHours)}
          </Typography>
        </Box>

        {/* Assigned to */}
        {intervention.assignedToName && (
          <Box display="flex" alignItems="center" mb={1.5}>
            <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
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
              <AssignmentIcon sx={{ fontSize: 18, mr: 1, mt: 0.25, color: 'text.secondary' }} />
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

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} size="small" sx={{ textTransform: 'none' }}>
          Fermer
        </Button>
        <Button
          variant="contained"
          onClick={handleViewDetails}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          Voir les details
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CalendarEventDialog;
