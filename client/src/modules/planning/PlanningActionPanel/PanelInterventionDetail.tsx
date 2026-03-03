import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Button,
  LinearProgress,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  AutoAwesome,
  Handyman,
  Person,
  Schedule,
  CalendarMonth,
  PlayArrow,
  CheckCircle,
  ExpandMore,
  AttachMoney,
} from '@mui/icons-material';
import type { PlanningEvent, PanelView } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import PanelPhotoGallery from './PanelPhotoGallery';

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error: string | null };

interface PanelInterventionDetailProps {
  interventionId: number;
  event: PlanningEvent;
  allEvents: PlanningEvent[];
  interventions?: PlanningIntervention[];
  onStartIntervention?: (interventionId: number) => Promise<ActionResult>;
  onCompleteIntervention?: (interventionId: number) => Promise<ActionResult>;
  onValidateIntervention?: (interventionId: number, estimatedCost: number) => Promise<ActionResult>;
  onUploadPhotos?: (interventionId: number, photos: File[], type: 'before' | 'after') => Promise<ActionResult>;
  onUpdateInterventionProgress?: (interventionId: number, progress: number) => Promise<ActionResult>;
  onAssignIntervention?: (interventionId: number, assigneeName: string) => Promise<ActionResult>;
  onSetPriority?: (interventionId: number, priority: 'normale' | 'haute' | 'urgente') => Promise<ActionResult>;
  onUpdateInterventionNotes?: (interventionId: number, notes: string) => Promise<ActionResult>;
  onUpdateInterventionDates?: (interventionId: number, updates: {
    startDate?: string; endDate?: string; startTime?: string; endTime?: string;
  }) => Promise<ActionResult>;
  onCreatePaymentSession?: (interventionIds: number[], total: number) => Promise<{ url: string; sessionId: string }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_HEX: Record<string, string> = {
  COMPLETED: '#4A9B8E',
  IN_PROGRESS: '#1976d2',
  PENDING: '#ED6C02',
  AWAITING_PAYMENT: '#D4A574',
  AWAITING_VALIDATION: '#D4A574',
  ASSIGNED: '#0288d1',
  SCHEDULED: '#0288d1',
  CANCELLED: '#d32f2f',
};

const parseCompletedSteps = (steps?: string): Set<string> => {
  if (!steps) return new Set();
  return new Set(steps.split(',').filter(Boolean));
};

// ─── Component ──────────────────────────────────────────────────────────────

const PanelInterventionDetail: React.FC<PanelInterventionDetailProps> = ({
  interventionId,
  event,
  allEvents,
  interventions,
  onStartIntervention,
  onCompleteIntervention,
  onUploadPhotos,
  onAssignIntervention,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find the intervention
  const intervention = interventions?.find((i) => i.id === interventionId)
    || (event.intervention?.id === interventionId ? event.intervention : null);

  if (!intervention) {
    return (
      <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
        Intervention #{interventionId} introuvable
      </Alert>
    );
  }

  const isCleaning = intervention.type === 'cleaning';
  const completedSteps = parseCompletedSteps(intervention.completedSteps);
  const isStarted = ['in_progress', 'awaiting_validation', 'completed'].includes(intervention.status);
  const isCompleted = ['completed', 'awaiting_validation'].includes(intervention.status);

  // Calculate progress
  let progress = 0;
  if (completedSteps.has('inspection')) progress += 33;
  if (completedSteps.has('rooms')) progress += 33;
  if (completedSteps.has('after_photos')) progress += 34;

  const estimatedCost = intervention.estimatedDurationHours
    ? intervention.estimatedDurationHours * 25
    : 0;

  const beforePhotos = intervention.beforePhotosUrls
    ? (typeof intervention.beforePhotosUrls === 'string'
        ? (intervention.beforePhotosUrls as string).split(',').filter(Boolean)
        : intervention.beforePhotosUrls as string[])
    : [];
  const afterPhotos = intervention.afterPhotosUrls
    ? (typeof intervention.afterPhotosUrls === 'string'
        ? (intervention.afterPhotosUrls as string).split(',').filter(Boolean)
        : intervention.afterPhotosUrls as string[])
    : [];

  const handleStart = useCallback(async () => {
    if (!onStartIntervention) return;
    setLoading(true);
    setError(null);
    const result = await onStartIntervention(interventionId);
    if (!result.success) setError(result.error);
    setLoading(false);
  }, [interventionId, onStartIntervention]);

  const handleComplete = useCallback(async () => {
    if (!onCompleteIntervention) return;
    setLoading(true);
    setError(null);
    const result = await onCompleteIntervention(interventionId);
    if (!result.success) setError(result.error);
    setLoading(false);
  }, [interventionId, onCompleteIntervention]);

  return (
    <Box>
      {/* Header with icon + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {isCleaning
          ? <AutoAwesome sx={{ fontSize: 20, color: '#9B7FC4' }} />
          : <Handyman sx={{ fontSize: 20, color: '#F59E0B' }} />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {intervention.title}
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
            {intervention.propertyName}
          </Typography>
        </Box>
      </Box>

      {/* Chips row */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
        {(() => { const c = STATUS_HEX[intervention.status] ?? '#757575'; return (
        <Chip
          label={intervention.status}
          size="small"
          sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
        />
        ); })()}
        {intervention.assigneeName && (
          <Chip
            icon={<Person sx={{ fontSize: 12, color: '#757575 !important' }} />}
            label={intervention.assigneeName}
            size="small"
            sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
        {intervention.estimatedDurationHours && (
          <Chip
            icon={<Schedule sx={{ fontSize: 12, color: '#0288d1 !important' }} />}
            label={`${intervention.estimatedDurationHours}h`}
            size="small"
            sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: '#0288d118', color: '#0288d1', border: '1px solid #0288d140', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
        {estimatedCost > 0 && (
          <Chip
            icon={<AttachMoney sx={{ fontSize: 12, color: '#4A9B8E !important' }} />}
            label={`${estimatedCost.toFixed(0)} €`}
            size="small"
            sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: '#4A9B8E18', color: '#4A9B8E', border: '1px solid #4A9B8E40', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
      </Box>

      {/* Dates */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1.5, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CalendarMonth sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: '0.6875rem' }}>
            {intervention.startDate}
            {intervention.startTime && ` ${intervention.startTime}`}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>→</Typography>
        <Typography sx={{ fontSize: '0.6875rem' }}>
          {intervention.endDate}
          {intervention.endTime && ` ${intervention.endTime}`}
        </Typography>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Progress section */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
            Progression
          </Typography>
          {(() => { const c = progress === 100 ? '#4A9B8E' : '#757575'; return (
          <Chip label={`${progress}%`} size="small" sx={{ fontSize: '0.5625rem', height: 18, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }} />
          ); })()}
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
          {['inspection', 'rooms', 'after_photos'].map((step) => {
            const done = completedSteps.has(step);
            const labels: Record<string, string> = { inspection: 'Inspection', rooms: 'Pièces', after_photos: 'Photos' };
            const c = done ? '#4A9B8E' : '#757575';
            return (
              <Chip
                key={step}
                label={labels[step]}
                size="small"
                sx={{ fontSize: '0.5rem', height: 18, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
              />
            );
          })}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ fontSize: '0.6875rem', mb: 1 }}>{error}</Alert>}

      {/* Action buttons */}
      {!isStarted && onStartIntervention && (
        <Button
          variant="contained"
          fullWidth
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrow sx={{ fontSize: 16 }} />}
          onClick={handleStart}
          disabled={loading}
          sx={{ mb: 1, textTransform: 'none', fontSize: '0.75rem' }}
        >
          Démarrer l'intervention
        </Button>
      )}

      {isStarted && !isCompleted && onCompleteIntervention && (
        <Button
          variant="contained"
          color="success"
          fullWidth
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 14 }} />}
          onClick={handleComplete}
          disabled={loading}
          sx={{ mb: 1, textTransform: 'none', fontSize: '0.75rem' }}
        >
          Terminer l'intervention
        </Button>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Photos preview */}
      <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Photos ({beforePhotos.length + afterPhotos.length})</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {beforePhotos.length > 0 && <PanelPhotoGallery photos={beforePhotos} label="Avant" maxVisible={2} />}
          {afterPhotos.length > 0 && <PanelPhotoGallery photos={afterPhotos} label="Après" maxVisible={2} />}
          {beforePhotos.length === 0 && afterPhotos.length === 0 && (
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
              Aucune photo
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Notes */}
      {intervention.notes && (
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' }}>
          <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Notes</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography sx={{ fontSize: '0.6875rem', whiteSpace: 'pre-wrap' }}>{intervention.notes}</Typography>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default PanelInterventionDetail;
