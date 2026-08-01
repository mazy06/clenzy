import React from 'react';
import StatusChip from '../../components/StatusChip';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Divider } from '@mui/material';
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
/** Tokens de la primitive pour une couleur semantique MUI historique. */
const chipColorTokens = (color: ChipColor) => {
  if (color === 'primary') return { color: 'var(--accent)', bg: 'var(--accent-soft)' };
  if (color === 'default') return { color: 'var(--muted)', bg: 'var(--field)' };
  const hex = semanticToHex(color);
  return { color: hex, bg: `${hex}1F` };
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
        <div className="flex gap-[4.5px] mb-3 flex-wrap">
          <StatusChip pill tokens={chipColorTokens(getStatusChipColor(intervention.status))} label={getStatusLabel(intervention.status)} />
          <StatusChip pill tokens={chipColorTokens(getPriorityChipColor(intervention.priority))} label={getPriorityLabel(intervention.priority)} />
          <StatusChip pill tokens={chipColorTokens('primary')} label={getTypeLabel(intervention.type, t)} />
        </div>

        <Divider sx={{ mb: 2 }} />

        {/* Property */}
        <div className="flex items-center mb-[9px]">
          <span className="inline-flex text-muted-foreground me-1.5"><LocationIcon size={18} strokeWidth={1.75} /></span>
          <div>
            <p className="cn-text-body2 font-medium">
              {intervention.propertyName}
            </p>
            {intervention.propertyAddress && (
              <span className="cn-text-caption text-muted-foreground">
                {intervention.propertyAddress}
              </span>
            )}
          </div>
        </div>

        {/* Scheduled date */}
        <div className="flex items-center mb-[9px]">
          <span className="inline-flex text-muted-foreground me-1.5"><CalendarIcon size={18} strokeWidth={1.75} /></span>
          <p className="cn-text-body2">
            {formatDate(intervention.scheduledDate)}
          </p>
        </div>

        {/* Duration */}
        <div className="flex items-center mb-[9px]">
          <span className="inline-flex text-muted-foreground me-1.5"><ScheduleIcon size={18} strokeWidth={1.75} /></span>
          <p className="cn-text-body2">
            {formatDuration(intervention.estimatedDurationHours)}
          </p>
        </div>

        {/* Assigned to */}
        {intervention.assignedToName && (
          <div className="flex items-center mb-[9px]">
            <span className="inline-flex text-muted-foreground me-1.5"><PersonIcon size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body2">
              {intervention.assignedToName}
            </p>
          </div>
        )}

        {/* Description */}
        {intervention.description && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <div className="flex items-start mb-1.5">
              <span className="inline-flex text-muted-foreground me-1.5 mt-0.5"><AssignmentIcon size={18} strokeWidth={1.75} /></span>
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
            </div>
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
