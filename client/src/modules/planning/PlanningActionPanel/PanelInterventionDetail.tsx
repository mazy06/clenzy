import React, { useState, useCallback, useEffect } from 'react';
import { Spinner } from '../../../components/ui';
import { Chip, Divider, Button, TextField, IconButton, LinearProgress, Alert, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
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
  Edit,
  EnterKey,
} from '../../../icons';
import type { PlanningEvent, PanelView } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { interventionsApi } from '../../../services/api/interventionsApi';
import PanelPhotoGallery from './PanelPhotoGallery';
import { Money } from '../../../components/Money';

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
  onAssignIntervention?: (interventionId: number, assigneeName: string, options?: { userId?: number; teamId?: number }) => Promise<ActionResult>;
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

  // ─── Édition du montant (nouveau montant / remise € / remise %) ───
  const [amountOverride, setAmountOverride] = useState<number | null>(null);
  const [amountEditOpen, setAmountEditOpen] = useState(false);
  const [amountMode, setAmountMode] = useState<'SET' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT'>('SET');
  const [amountValue, setAmountValue] = useState('');
  const [amountSaving, setAmountSaving] = useState(false);

  // Réinitialise l'override quand on change d'intervention.
  useEffect(() => {
    setAmountOverride(null);
    setAmountEditOpen(false);
    setAmountValue('');
    setAmountMode('SET');
  }, [interventionId]);

  const applyAmount = useCallback(async () => {
    const num = parseFloat(amountValue);
    if (isNaN(num) || num < 0) return;
    setAmountSaving(true);
    setError(null);
    try {
      const updated = await interventionsApi.updateAmount(interventionId, amountMode, num);
      setAmountOverride(updated.actualCost ?? updated.estimatedCost ?? 0);
      setAmountEditOpen(false);
      setAmountValue('');
    } catch {
      setError("Impossible de mettre à jour le montant");
    } finally {
      setAmountSaving(false);
    }
  }, [amountValue, amountMode, interventionId]);

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

  // Montant RÉEL de l'intervention (devis/travaux), pas une estimation fabriquée.
  const realAmount = intervention.actualCost ?? intervention.estimatedCost ?? 0;
  const displayAmount = amountOverride ?? realAmount;

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

  return (
    <div>
      {/* Header with icon + title */}
      <div className="flex items-center gap-1.5 mb-2">
        {isCleaning
          ? <AutoAwesome size={20} strokeWidth={1.75} color='#9B7FC4' />
          : <Handyman size={20} strokeWidth={1.75} color='#F59E0B' />}
        <div className="flex-1 min-w-0">
          <p className="cn-text-body1 font-bold text-[0.875rem] overflow-hidden text-ellipsis whitespace-nowrap">
            {intervention.title}
          </p>
          <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
            {intervention.propertyName}
          </p>
        </div>
      </div>

      {/* Chips row */}
      <div className="flex gap-0.5 flex-wrap mb-2">
        {(() => { const c = STATUS_HEX[intervention.status] ?? '#757575'; return (
        <Chip
          label={intervention.status}
          size="small"
          sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
        />
        ); })()}
        {intervention.assigneeName && (
          <Chip
            icon={<Person size={12} strokeWidth={1.75} color="#757575" />}
            label={intervention.assigneeName}
            size="small"
            sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
        {intervention.estimatedDurationHours && (
          <Chip
            icon={<Schedule size={12} strokeWidth={1.75} color="#0288d1" />}
            label={`${intervention.estimatedDurationHours}h`}
            size="small"
            sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: '#0288d118', color: '#0288d1', border: '1px solid #0288d140', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
        <Chip
          icon={<AttachMoney size={12} strokeWidth={1.75} color="#4A9B8E" />}
          label={<Money value={displayAmount} from="EUR" decimals={0} />}
          onClick={() => setAmountEditOpen((o) => !o)}
          onDelete={() => setAmountEditOpen((o) => !o)}
          deleteIcon={<Edit size={11} strokeWidth={1.75} />}
          size="small"
          sx={{ fontSize: '0.5625rem', height: 22, fontWeight: 600, backgroundColor: '#4A9B8E18', color: '#4A9B8E', border: '1px solid #4A9B8E40', borderRadius: '6px', cursor: 'pointer', '& .MuiChip-label': { px: 0.75 }, '& .MuiChip-deleteIcon': { color: '#4A9B8E', fontSize: 12 } }}
        />
      </div>

      {/* Édition du montant : nouveau montant / remise € / remise % */}
      {amountEditOpen && (
        <div className="mb-2 p-2 rounded-[10px] border border-[var(--line)] bg-[var(--field)]">
          <div className="flex gap-0.5 mb-1.5 flex-wrap">
            {([
              ['SET', 'Nouveau montant'],
              ['DISCOUNT_AMOUNT', 'Remise €'],
              ['DISCOUNT_PERCENT', 'Remise %'],
            ] as const).map(([mode, label]) => {
              const active = amountMode === mode;
              return (
                <Chip
                  key={mode}
                  label={label}
                  onClick={() => setAmountMode(mode)}
                  size="small"
                  sx={{
                    height: 24, fontSize: '0.625rem', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--line-2)',
                    bgcolor: active ? 'var(--accent-soft)' : 'var(--card)',
                    color: active ? 'var(--accent)' : 'var(--body)',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <TextField
              type="number"
              size="small"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyAmount(); } }}
              placeholder={amountMode === 'DISCOUNT_PERCENT' ? '10' : '0'}
              disabled={amountSaving}
              inputProps={{ min: 0, step: amountMode === 'DISCOUNT_PERCENT' ? 1 : 5, style: { textAlign: 'right' } }}
              InputProps={{ endAdornment: (
                <p className="cn-text-body1 text-[0.75rem] text-[var(--faint)] ps-0.5">
                  {amountMode === 'DISCOUNT_PERCENT' ? '%' : '€'}
                </p>
              ) }}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.8125rem', bgcolor: 'var(--card)' } }}
            />
            <IconButton
              size="small"
              onClick={applyAmount}
              disabled={amountSaving || !amountValue.trim()}
              aria-label="Appliquer"
              sx={{ color: 'var(--accent)' }}
            >
              {amountSaving ? <Spinner className="size-4" /> : <EnterKey size={16} strokeWidth={1.75} />}
            </IconButton>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="flex gap-3 mb-2 items-center">
        <div className="flex items-center gap-0.5">
          <span className="inline-flex text-muted-foreground"><CalendarMonth size={14} strokeWidth={1.75} /></span>
          <p className="cn-text-body1 text-[0.6875rem]">
            {intervention.startDate}
            {intervention.startTime && ` ${intervention.startTime}`}
          </p>
        </div>
        <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">→</p>
        <p className="cn-text-body1 text-[0.6875rem]">
          {intervention.endDate}
          {intervention.endTime && ` ${intervention.endTime}`}
        </p>
      </div>

      <Divider sx={{ my: 1.5 }} />

      {/* Progress section */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-0.5">
          <p className="cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            Progression
          </p>
          {(() => { const c = progress === 100 ? '#4A9B8E' : '#757575'; return (
          <Chip label={`${progress}%`} size="small" sx={{ fontSize: '0.5625rem', height: 18, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }} />
          ); })()}
        </div>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
        <div className="flex gap-0.5 mt-1">
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
        </div>
      </div>

      {error && <Alert severity="error" sx={{ fontSize: '0.6875rem', mb: 1 }}>{error}</Alert>}

      {/* Action buttons */}
      {!isStarted && onStartIntervention && (
        <Button
          variant="contained"
          fullWidth
          size="small"
          startIcon={loading ? <Spinner className="size-3.5" /> : <PlayArrow size={16} strokeWidth={1.75} />}
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
          startIcon={loading ? <Spinner className="size-3.5" /> : <CheckCircle size={14} strokeWidth={1.75} />}
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
        <AccordionSummary expandIcon={<ExpandMore size={16} strokeWidth={1.75} />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <p className="cn-text-body1 text-[0.75rem] font-semibold">Photos ({beforePhotos.length + afterPhotos.length})</p>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {beforePhotos.length > 0 && <PanelPhotoGallery photos={beforePhotos} label="Avant" maxVisible={2} />}
          {afterPhotos.length > 0 && <PanelPhotoGallery photos={afterPhotos} label="Après" maxVisible={2} />}
          {beforePhotos.length === 0 && afterPhotos.length === 0 && (
            <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic">
              Aucune photo
            </p>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Notes */}
      {intervention.notes && (
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' }}>
          <AccordionSummary expandIcon={<ExpandMore size={16} strokeWidth={1.75} />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <p className="cn-text-body1 text-[0.75rem] font-semibold">Notes</p>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <p className="cn-text-body1 text-[0.6875rem] whitespace-pre-wrap">{intervention.notes}</p>
          </AccordionDetails>
        </Accordion>
      )}
    </div>
  );
};

export default PanelInterventionDetail;
