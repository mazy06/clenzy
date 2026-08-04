import React, { useState, useCallback, useEffect } from 'react';
import StatusChip, { STATUS_TONES } from '../../../components/StatusChip';
import { Alert, AlertDescription, Button, InputGroup, InputGroupAddon, InputGroupInput } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Progress,
  Separator,
} from '../../../components/ui';
import {
  AutoAwesome,
  Handyman,
  Person,
  Schedule,
  CalendarMonth,
  PlayArrow,
  CheckCircle,
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

/** Coque de l'accordeon : le liseré et le rayon que portait le `sx` MUI. */
const ACCORDION_CLASS = 'rounded-[8px] border border-solid border-[var(--line)] overflow-hidden';
/** En-tete d'accordeon : hauteur 36 et gouttieres reprises du gabarit MUI. */
const ACCORDION_TRIGGER_CLASS = 'min-h-9 items-center px-2 py-1';

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
      <Alert variant="warning" className="text-[0.75rem]">
        <TriangleAlert />
        <AlertDescription>Intervention #{interventionId}introuvable</AlertDescription>
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
        <StatusChip tokens={{ color: c, bg: `${c}18` }} label={intervention.status} className="text-[0.5625rem]" />
        ); })()}
        {intervention.assigneeName && (
          <StatusChip tokens={{ color: '#757575', bg: '#75757518' }} label={intervention.assigneeName} icon={<Person size={12} strokeWidth={1.75} color="#757575" />} className="text-[0.5625rem]" />
        )}
        {intervention.estimatedDurationHours && (
          <StatusChip tokens={{ color: '#0288d1', bg: '#0288d118' }} label={`${intervention.estimatedDurationHours}h`} icon={<Schedule size={12} strokeWidth={1.75} color="#0288d1" />} className="text-[0.5625rem]" />
        )}
        {/* Le crayon etait monte en `deleteIcon`, avec un `onDelete` qui basculait
            le meme panneau que le corps de la puce : une seule action, donc une
            seule commande — le crayon n'est plus qu'un decor. */}
        <StatusChip
          tokens={{ color: '#4A9B8E', bg: '#4A9B8E18' }}
          icon={<AttachMoney size={12} strokeWidth={1.75} color="#4A9B8E" />}
          label={
            <span className="inline-flex items-center gap-0.5">
              <Money value={displayAmount} from="EUR" decimals={0} />
              <Edit size={11} strokeWidth={1.75} />
            </span>
          }
          onClick={() => setAmountEditOpen((o) => !o)}
          ariaLabel="Modifier le montant"
          className="text-[0.5625rem] border border-solid border-[#4A9B8E40]"
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
                <StatusChip
                  key={mode}
                  outlined
                  selected={active}
                  tokens={STATUS_TONES.accent}
                  label={label}
                  onClick={() => setAmountMode(mode)}
                  className="h-6 text-[0.625rem] font-semibold"
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            {/* Le champ n'avait pas de libelle : les puces de mode au-dessus font
                office d'intitule, d'ou l'aria-label qui reprend le mode actif. */}
            <InputGroup className="flex-1 bg-[var(--card)]">
              <InputGroupInput
                id="intervention-amount"
                type="number"
                value={amountValue}
                onChange={(e) => setAmountValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyAmount(); } }}
                placeholder={amountMode === 'DISCOUNT_PERCENT' ? '10' : '0'}
                disabled={amountSaving}
                min={0}
                step={amountMode === 'DISCOUNT_PERCENT' ? 1 : 5}
                aria-label={amountMode === 'DISCOUNT_PERCENT' ? 'Remise en pourcentage' : amountMode === 'DISCOUNT_AMOUNT' ? 'Remise en euros' : 'Nouveau montant'}
                className="text-end text-[0.8125rem]"
              />
              <InputGroupAddon align="inline-end">
                <span className="cn-text-body1 text-[0.75rem] text-[var(--faint)]">
                  {amountMode === 'DISCOUNT_PERCENT' ? '%' : '€'}
                </span>
              </InputGroupAddon>
            </InputGroup>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={applyAmount}
              disabled={amountSaving || !amountValue.trim()}
              aria-label="Appliquer"
              className="text-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              {amountSaving ? <Spinner className="size-4" /> : <EnterKey size={16} strokeWidth={1.75} />}
            </Button>
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

      <Separator className="my-[9px]" />

      {/* Progress section */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-0.5">
          <p className="cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            Progression
          </p>
          {(() => { const c = progress === 100 ? '#4A9B8E' : '#757575'; return (
          <StatusChip size="sm" tokens={{ color: c, bg: `${c}18` }} label={`${progress}%`} className="text-[0.5625rem]" />
          ); })()}
        </div>
        <Progress
          value={progress}
          className="h-1.5 rounded-[3px] [&_[data-slot=progress-indicator]]:rounded-[3px]"
        />
        <div className="flex gap-0.5 mt-1">
          {['inspection', 'rooms', 'after_photos'].map((step) => {
            const done = completedSteps.has(step);
            const labels: Record<string, string> = { inspection: 'Inspection', rooms: 'Pièces', after_photos: 'Photos' };
            const c = done ? '#4A9B8E' : '#757575';
            return (
              <StatusChip size="sm" tokens={{ color: c, bg: `${c}18` }} label={labels[step]} className="text-[0.5rem]" key={step} />
            );
          })}
        </div>
      </div>

      {error && <Alert variant="destructive" className="text-[0.6875rem] mb-1.5">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {/* Action buttons */}
      {!isStarted && onStartIntervention && (
        <Button
          size="sm"
          onClick={handleStart}
          disabled={loading}
          className="w-full mb-1.5 shrink"
        >
          {loading ? <Spinner className="size-3.5" /> : <PlayArrow strokeWidth={1.75} />}
          Démarrer l'intervention
        </Button>
      )}

      {isStarted && !isCompleted && onCompleteIntervention && (
        // `color="success"` n'a pas de variante dediee dans le kit : outline
        // teinte --ok.
        <Button
          variant="outline"
          size="sm"
          onClick={handleComplete}
          disabled={loading}
          className="w-full mb-1.5 text-[var(--ok)] border-[var(--ok)] hover:bg-[var(--ok-soft)] shrink"
        >
          {loading ? <Spinner className="size-3.5" /> : <CheckCircle strokeWidth={1.75} />}
          Terminer l'intervention
        </Button>
      )}

      <Separator className="my-[9px]" />

      {/* Photos preview */}
      {/* Le chevron est fourni par AccordionTrigger : plus d'expandIcon a passer. */}
      <Accordion type="single" collapsible className={ACCORDION_CLASS + ' mb-1'}>
        <AccordionItem value="photos" className="border-b-0">
          <AccordionTrigger className={ACCORDION_TRIGGER_CLASS}>
            <p className="cn-text-body1 text-[0.75rem] font-semibold">Photos ({beforePhotos.length + afterPhotos.length})</p>
          </AccordionTrigger>
          <AccordionContent className="px-2 pt-0">
            {beforePhotos.length > 0 && <PanelPhotoGallery photos={beforePhotos} label="Avant" maxVisible={2} />}
            {afterPhotos.length > 0 && <PanelPhotoGallery photos={afterPhotos} label="Après" maxVisible={2} />}
            {beforePhotos.length === 0 && afterPhotos.length === 0 && (
              <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic">
                Aucune photo
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Notes */}
      {intervention.notes && (
        <Accordion type="single" collapsible className={ACCORDION_CLASS}>
          <AccordionItem value="notes" className="border-b-0">
            <AccordionTrigger className={ACCORDION_TRIGGER_CLASS}>
              <p className="cn-text-body1 text-[0.75rem] font-semibold">Notes</p>
            </AccordionTrigger>
            <AccordionContent className="px-2 pt-0">
              <p className="cn-text-body1 text-[0.6875rem] whitespace-pre-wrap">{intervention.notes}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

export default PanelInterventionDetail;
