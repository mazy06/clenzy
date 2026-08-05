import React from 'react';
import StatusChip, { type ToneTokens } from '../../components/StatusChip';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from '../../components/ui';
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

// ─── Chips soft (pilule fond -soft + encre -ink — règle Baitly UI §2.4) ──────

/**
 * Couleur sémantique historique → couple Baitly UI. Le texte prend l'encre
 * `-ink` (la teinte vive plafonne à ~2,2:1 sur une carte claire), le fond la
 * déclinaison `-soft`.
 */
const CHIP_TOKENS: Partial<Record<ChipColor, ToneTokens>> = {
  primary: { color: 'var(--bui-primary)', bg: 'var(--bui-primary-soft)' },
  default: { color: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' },
  success: { color: 'var(--bui-success-ink)', bg: 'var(--bui-success-soft)' },
  warning: { color: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)' },
  error: { color: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  info: { color: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' },
};

/** Tokens de la primitive pour une couleur semantique historique. */
const chipColorTokens = (color: ChipColor): ToneTokens => {
  const tokens = CHIP_TOKENS[color];
  if (tokens) return tokens;
  // `secondary` n'a pas d'équivalent sémantique Baitly : on garde sa teinte.
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="pe-8">{intervention.title}</DialogTitle>
          <DialogDescription>{intervention.propertyName}</DialogDescription>
        </DialogHeader>

        {/* Chips: Status, Priority, Type — pilules soft (jamais d'aplat plein) */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <StatusChip pill tokens={chipColorTokens(getStatusChipColor(intervention.status))} label={getStatusLabel(intervention.status)} />
          <StatusChip pill tokens={chipColorTokens(getPriorityChipColor(intervention.priority))} label={getPriorityLabel(intervention.priority)} />
          <StatusChip pill tokens={chipColorTokens('primary')} label={getTypeLabel(intervention.type, t)} />
        </div>

        <Separator className="mb-3" />

        {/* Fiche : une ligne « icône + valeur » par attribut */}
        <div className="flex flex-col gap-2">
          {/* Property */}
          <div className="flex items-center">
            <span className="inline-flex text-muted-foreground me-1.5"><LocationIcon size={18} strokeWidth={1.75} /></span>
            <div>
              <p className="text-xs font-medium text-foreground">
                {intervention.propertyName}
              </p>
              {intervention.propertyAddress && (
                <span className="text-xs text-muted-foreground">
                  {intervention.propertyAddress}
                </span>
              )}
            </div>
          </div>

          {/* Scheduled date */}
          <div className="flex items-center">
            <span className="inline-flex text-muted-foreground me-1.5"><CalendarIcon size={18} strokeWidth={1.75} /></span>
            <p className="text-xs text-foreground tabular-nums">
              {formatDate(intervention.scheduledDate)}
            </p>
          </div>

          {/* Duration */}
          <div className="flex items-center">
            <span className="inline-flex text-muted-foreground me-1.5"><ScheduleIcon size={18} strokeWidth={1.75} /></span>
            <p className="text-xs text-foreground tabular-nums">
              {formatDuration(intervention.estimatedDurationHours)}
            </p>
          </div>

          {/* Assigned to */}
          {intervention.assignedToName && (
            <div className="flex items-center">
              <span className="inline-flex text-muted-foreground me-1.5"><PersonIcon size={18} strokeWidth={1.75} /></span>
              <p className="text-xs text-foreground">
                {intervention.assignedToName}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        {intervention.description && (
          <>
            <Separator className="my-2" />
            <div className="mb-1.5 flex items-start">
              <span className="inline-flex text-muted-foreground me-1.5 mt-0.5"><AssignmentIcon size={18} strokeWidth={1.75} /></span>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {intervention.description}
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button size="sm" onClick={handleViewDetails}>
            Voir les details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarEventDialog;
