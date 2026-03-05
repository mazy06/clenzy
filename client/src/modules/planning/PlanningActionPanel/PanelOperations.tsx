import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Switch,
  FormControlLabel,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  AutoAwesome,
  Handyman,
  Groups,
  PriorityHigh,
  CheckCircleOutline,
  NotificationsActive,
  Add,
  Close,
  Check,
  AutoFixHigh,
  CalendarMonth,
  Schedule,
  SwapHoriz,
  Edit,
  CheckCircle,
  ChevronRight,
  Search as InspectIcon,
  MeetingRoom,
  CameraAlt,
  Send,
  OpenInNew,
  CleaningServices,
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import type { ServiceRequest } from '../../../services/api/serviceRequestsApi';
import { useWorkflowSettings } from '../../../hooks/useWorkflowSettings';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import CreateServiceRequestDialog from './CreateServiceRequestDialog';

// ── Staff list (shared with CreateInterventionDialog) ──────────────────────
const STAFF_OPTIONS = [
  'Fatou Diallo',
  'Carmen Lopez',
  'Nathalie Blanc',
  'Amina Keita',
  'Lucie Moreau',
  'Marc Dupuis',
  'Jean-Pierre Martin',
  'Thomas Bernard',
];

const PRIORITY_OPTIONS: { value: 'normale' | 'haute' | 'urgente'; label: string; color: string }[] = [
  { value: 'normale', label: 'Normale', color: '#6B7280' },
  { value: 'haute', label: 'Haute', color: '#F59E0B' },
  { value: 'urgente', label: 'Urgente', color: '#EF4444' },
];

const DEFAULT_CHECKLIST = [
  'Verifier les equipements',
  'Nettoyage des surfaces',
  'Inspection des sanitaires',
  'Verification du linge',
  'Photo de controle',
];

// ── Service request status colors ────────────────────────────────────────────
const SR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: '#F59E0B' },
  APPROVED: { label: 'Approuvée', color: '#3B82F6' },
  DEVIS_ACCEPTED: { label: 'Devis accepté', color: '#8B5CF6' },
  IN_PROGRESS: { label: 'En cours', color: '#1976d2' },
  COMPLETED: { label: 'Terminée', color: '#4A9B8E' },
  CANCELLED: { label: 'Annulée', color: '#9e9e9e' },
  REJECTED: { label: 'Rejetée', color: '#d32f2f' },
};

// ── Service type labels ─────────────────────────────────────────────────────
const SERVICE_TYPE_LABELS: Record<string, string> = {
  CLEANING: 'Ménage',
  EXPRESS_CLEANING: 'Ménage express',
  DEEP_CLEANING: 'Nettoyage profond',
  PREVENTIVE_MAINTENANCE: 'Maintenance',
  EMERGENCY_REPAIR: 'Réparation urgente',
  ELECTRICAL_REPAIR: 'Électricité',
  PLUMBING_REPAIR: 'Plomberie',
  HVAC_REPAIR: 'Climatisation',
  OTHER: 'Autre',
};

interface PanelOperationsProps {
  event: PlanningEvent;
  allEvents?: PlanningEvent[];
  interventions?: PlanningIntervention[];
  /** Linked service requests for the current property (reservation view) */
  serviceRequests?: ServiceRequest[];
  onAssignIntervention?: (interventionId: number, assigneeName: string) => Promise<{ success: boolean; error: string | null }>;
  onSetPriority?: (interventionId: number, priority: 'normale' | 'haute' | 'urgente') => Promise<{ success: boolean; error: string | null }>;
  onUpdateInterventionNotes?: (interventionId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
  onUpdateInterventionDates?: (interventionId: number, updates: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  }) => Promise<{ success: boolean; error: string | null }>;
  /** Called when a new service request is created from the planning sidebar */
  onServiceRequestCreated?: () => void;
  onNavigate?: (view: import('../types').PanelView) => void;
}

const PanelOperations: React.FC<PanelOperationsProps> = ({
  event,
  allEvents,
  interventions,
  serviceRequests,
  onAssignIntervention,
  onSetPriority,
  onUpdateInterventionNotes,
  onUpdateInterventionDates,
  onServiceRequestCreated,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const isReservation = event.type === 'reservation';
  const intervention = event.intervention;
  const reservation = event.reservation;

  // ── Role check: only SUPER_ADMIN, SUPER_MANAGER, or org ADMIN can edit interventions ──
  const { user } = useAuth();
  const canEditIntervention =
    user?.roles?.some(r => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ||
    user?.orgRole === 'ADMIN';

  // ── Workflow settings (auto-assign feature flag) ───────────────────────────
  const { settings: workflowSettings } = useWorkflowSettings();
  const autoAssignEnabled = workflowSettings.autoAssignInterventions;

  // ── Dialog states ──────────────────────────────────────────────────────────
  const [srDialogOpen, setSrDialogOpen] = useState(false);
  const [srDialogDefaultType, setSrDialogDefaultType] = useState<string | undefined>(undefined);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PlanningIntervention | null>(null);
  const [assignValue, setAssignValue] = useState('');
  const [assignAutoMode, setAssignAutoMode] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [priorityTarget, setPriorityTarget] = useState<PlanningIntervention | null>(null);
  const [priorityValue, setPriorityValue] = useState<'normale' | 'haute' | 'urgente'>('normale');
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<{ text: string; checked: boolean }[]>(
    DEFAULT_CHECKLIST.map((text) => ({ text, checked: false })),
  );
  const [checklistSaving, setChecklistSaving] = useState(false);

  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertDate, setAlertDate] = useState('');
  const [alertTime, setAlertTime] = useState('09:00');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSaving, setAlertSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  /** Find interventions linked to this reservation */
  const linkedInterventions = isReservation && reservation
    ? (interventions || []).filter((i) => i.linkedReservationId === reservation.id && i.status !== 'cancelled')
    : [];

  /** The target intervention for assign / priority buttons */
  const targetIntervention = intervention || (linkedInterventions.length > 0 ? linkedInterventions[0] : null);

  /**
   * Auto-assign suggestion: pick the staff member with the fewest
   * active interventions overlapping the target intervention's date range.
   */
  const autoAssignSuggestion = useMemo(() => {
    if (!assignTarget || !autoAssignEnabled) return null;

    const targetStart = assignTarget.startDate;
    const targetEnd = assignTarget.endDate;
    const allInterventions = interventions || [];

    // Count overlapping interventions per staff member
    const workload: Record<string, number> = {};
    for (const name of STAFF_OPTIONS) {
      workload[name] = 0;
    }

    for (const intv of allInterventions) {
      if (intv.id === assignTarget.id) continue;
      if (intv.status === 'cancelled') continue;
      // Check date overlap
      if (intv.startDate <= targetEnd && intv.endDate >= targetStart) {
        if (intv.assigneeName && workload[intv.assigneeName] !== undefined) {
          workload[intv.assigneeName]++;
        }
      }
    }

    // Sort by workload (ascending), pick the least busy
    const sorted = STAFF_OPTIONS.slice().sort((a, b) => workload[a] - workload[b]);
    const bestName = sorted[0];
    const bestWorkload = workload[bestName];

    return {
      name: bestName,
      overlappingCount: bestWorkload,
      reason: bestWorkload === 0
        ? 'Aucune intervention sur ce creneau'
        : `${bestWorkload} intervention${bestWorkload > 1 ? 's' : ''} sur ce creneau (le moins charge)`,
    };
  }, [assignTarget, interventions, autoAssignEnabled]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  // 1. Demande de menage → open CreateServiceRequestDialog with type='CLEANING'
  const handleCleaningRequestClick = () => {
    setSrDialogDefaultType('CLEANING');
    setSrDialogOpen(true);
  };

  // 2. Demande de maintenance → open CreateServiceRequestDialog with type='PREVENTIVE_MAINTENANCE'
  const handleMaintenanceRequestClick = () => {
    setSrDialogDefaultType('PREVENTIVE_MAINTENANCE');
    setSrDialogOpen(true);
  };

  // 3. Nouvelle demande de service → open CreateServiceRequestDialog with type='OTHER'
  const handleNewServiceRequestClick = () => {
    setSrDialogDefaultType('OTHER');
    setSrDialogOpen(true);
  };

  // 4. Assigner equipe / prestataire
  const handleAssignClick = () => {
    if (!targetIntervention) {
      showSnackbar('Aucune intervention a assigner. Creez d\'abord une intervention.', 'error');
      return;
    }
    setAssignTarget(targetIntervention);
    setAssignValue(targetIntervention.assigneeName || '');
    setAssignAutoMode(false);
    setAssignError(null);
    setAssignDialogOpen(true);
  };

  /** When auto-assign toggle changes, auto-fill the best suggestion */
  const handleAutoAssignToggle = (checked: boolean) => {
    setAssignAutoMode(checked);
    if (checked && autoAssignSuggestion) {
      setAssignValue(autoAssignSuggestion.name);
    }
  };

  const handleAssignConfirm = async () => {
    if (!assignTarget || !assignValue || !onAssignIntervention) return;
    setAssignLoading(true);
    setAssignError(null);
    const result = await onAssignIntervention(assignTarget.id, assignValue);
    setAssignLoading(false);
    if (result.success) {
      setAssignDialogOpen(false);
      showSnackbar(`Intervention assignee a ${assignValue}`);
    } else {
      setAssignError(result.error);
    }
  };

  // 5. Definir priorite
  const handlePriorityClick = () => {
    if (!targetIntervention) {
      showSnackbar('Aucune intervention. Creez d\'abord une intervention.', 'error');
      return;
    }
    setPriorityTarget(targetIntervention);
    // Parse current priority from notes
    const match = targetIntervention.notes?.match(/^\[PRIORITE: (\w+)\]/);
    if (match) {
      const p = match[1].toLowerCase();
      setPriorityValue(p === 'haute' ? 'haute' : p === 'urgente' ? 'urgente' : 'normale');
    } else {
      setPriorityValue('normale');
    }
    setPriorityError(null);
    setPriorityDialogOpen(true);
  };

  const handlePriorityConfirm = async () => {
    if (!priorityTarget || !onSetPriority) return;
    setPriorityLoading(true);
    setPriorityError(null);
    const result = await onSetPriority(priorityTarget.id, priorityValue);
    setPriorityLoading(false);
    if (result.success) {
      setPriorityDialogOpen(false);
      showSnackbar(`Priorite definie : ${priorityValue}`);
    } else {
      setPriorityError(result.error);
    }
  };

  // 6. Checklist
  const handleChecklistToggle = (index: number) => {
    setChecklistItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)),
    );
  };

  const handleChecklistSave = async () => {
    if (!targetIntervention || !onUpdateInterventionNotes) return;
    setChecklistSaving(true);
    const checklistText = checklistItems
      .map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)
      .join('\n');
    const existingNotes = targetIntervention.notes || '';
    const cleanedNotes = existingNotes.replace(/\n?--- Checklist ---[\s\S]*$/, '');
    const newNotes = cleanedNotes + '\n--- Checklist ---\n' + checklistText;
    const result = await onUpdateInterventionNotes(targetIntervention.id, newNotes.trim());
    setChecklistSaving(false);
    if (result.success) {
      setChecklistOpen(false);
      showSnackbar('Checklist enregistree');
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  // 7. Alerte / rappel
  const handleAlertSave = async () => {
    if (!targetIntervention || !onUpdateInterventionNotes) return;
    if (!alertDate || !alertMessage.trim()) return;
    setAlertSaving(true);
    const alertText = `\n--- Rappel ${alertDate} ${alertTime} ---\n${alertMessage.trim()}`;
    const existingNotes = targetIntervention.notes || '';
    const newNotes = existingNotes + alertText;
    const result = await onUpdateInterventionNotes(targetIntervention.id, newNotes.trim());
    setAlertSaving(false);
    if (result.success) {
      setAlertDialogOpen(false);
      setAlertDate('');
      setAlertTime('09:00');
      setAlertMessage('');
      showSnackbar('Rappel ajoute');
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  // ── Property info for creating interventions ───────────────────────────────
  const propertyId = event.propertyId;
  const propertyName = isReservation && reservation
    ? reservation.propertyName
    : intervention
      ? intervention.propertyName
      : '';

  const today = new Date().toISOString().split('T')[0];

  // ── Editable Intervention Dates Section ─────────────────────────────────
  const EditableInterventionDatesSection: React.FC = () => {
    const intv = intervention!;
    const [editing, setEditing] = useState(false);
    const [startDate, setStartDate] = useState(intv.startDate);
    const [endDate, setEndDate] = useState(intv.endDate);
    const [startTime, setStartTime] = useState(intv.startTime || '');
    const [endTime, setEndTime] = useState(intv.endTime || '');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Reset when intervention changes
    useEffect(() => {
      setStartDate(intv.startDate);
      setEndDate(intv.endDate);
      setStartTime(intv.startTime || '');
      setEndTime(intv.endTime || '');
      setEditing(false);
      setValidationError(null);
    }, [intv.id, intv.startDate, intv.endDate, intv.startTime, intv.endTime]);

    const hasChanges =
      startDate !== intv.startDate ||
      endDate !== intv.endDate ||
      startTime !== (intv.startTime || '') ||
      endTime !== (intv.endTime || '');

    const handleSave = async () => {
      if (!onUpdateInterventionDates || !hasChanges) return;
      setValidationError(null);
      setSaving(true);

      const updates: { startDate?: string; endDate?: string; startTime?: string; endTime?: string } = {};
      if (startDate !== intv.startDate) updates.startDate = startDate;
      if (endDate !== intv.endDate) updates.endDate = endDate;
      if (startTime !== (intv.startTime || '')) updates.startTime = startTime;
      if (endTime !== (intv.endTime || '')) updates.endTime = endTime;

      const result = await onUpdateInterventionDates(intv.id, updates);
      setSaving(false);
      if (result.success) {
        setEditing(false);
        showSnackbar('Dates mises a jour');
      } else {
        setValidationError(result.error);
      }
    };

    const handleCancel = () => {
      setStartDate(intv.startDate);
      setEndDate(intv.endDate);
      setStartTime(intv.startTime || '');
      setEndTime(intv.endTime || '');
      setEditing(false);
      setValidationError(null);
    };

    return (
      <Box sx={{ mt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, fontSize: '0.8125rem' }}>
            Dates & Horaires
          </Typography>
          {!editing ? (
            <IconButton size="small" onClick={() => setEditing(true)} sx={{ p: 0.25 }}>
              <Edit sx={{ fontSize: 14, color: 'text.secondary' }} />
            </IconButton>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                sx={{ p: 0.25, color: 'success.main' }}
              >
                {saving ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />}
              </IconButton>
              <IconButton size="small" onClick={handleCancel} sx={{ p: 0.25, color: 'error.main' }}>
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}
        </Box>

        {!editing ? (
          /* Display mode */
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Debut</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                {intv.startDate}
              </Typography>
              {intv.startTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                  <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    {intv.startTime}
                  </Typography>
                </Box>
              )}
            </Box>
            <SwapHoriz sx={{ color: 'text.disabled' }} />
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Fin</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                {intv.endDate}
              </Typography>
              {intv.endTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, justifyContent: 'flex-end' }}>
                  <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    {intv.endTime}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          /* Edit mode */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.25, display: 'block' }}>
                Debut
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  type="date"
                  size="small"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                  inputProps={{ style: { padding: '6px 8px' } }}
                />
                <TextField
                  type="time"
                  size="small"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="HH:mm"
                  sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                  inputProps={{ style: { padding: '6px 8px' } }}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.25, display: 'block' }}>
                Fin
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  type="date"
                  size="small"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                  inputProps={{ style: { padding: '6px 8px' } }}
                />
                <TextField
                  type="time"
                  size="small"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="HH:mm"
                  sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                  inputProps={{ style: { padding: '6px 8px' } }}
                />
              </Box>
            </Box>

            {validationError && (
              <Alert
                severity="error"
                onClose={() => setValidationError(null)}
                sx={{
                  fontSize: '0.75rem',
                  py: 0,
                  '& .MuiAlert-message': { fontSize: '0.75rem' },
                  '& .MuiAlert-icon': { fontSize: '1rem', py: 0.5 },
                }}
              >
                {validationError}
              </Alert>
            )}

            {hasChanges && intv.linkedReservationId && !validationError && (
              <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.625rem' }}>
                L'intervention sera deliee de sa reservation si les dates sont modifiees.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Intervention info (if clicking on an intervention) */}
      {intervention && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {intervention.type === 'cleaning' ? (
              <AutoAwesome sx={{ fontSize: 20, color: '#9B7FC4' }} />
            ) : (
              <Handyman sx={{ fontSize: 20, color: '#7EBAD0' }} />
            )}
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {intervention.title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            {(() => { const c = intervention.status === 'completed' ? '#4A9B8E' : intervention.status === 'in_progress' ? '#1976d2' : intervention.status === 'cancelled' ? '#d32f2f' : '#ED6C02'; return (
            <Chip label={intervention.status} size="small" sx={{ fontSize: '0.625rem', fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }} />
            ); })()}
            <Chip label={intervention.assigneeName} size="small" sx={{ fontSize: '0.625rem', fontWeight: 600, backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }} />
            {intervention.estimatedDurationHours && (
              <Chip label={`${intervention.estimatedDurationHours}h`} size="small" sx={{ fontSize: '0.625rem', fontWeight: 600, backgroundColor: '#0288d118', color: '#0288d1', border: '1px solid #0288d140', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }} />
            )}
          </Box>
          {intervention.notes && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-line' }}>
              {intervention.notes}
            </Typography>
          )}
          {canEditIntervention && <EditableInterventionDatesSection />}
          <Divider sx={{ my: 1 }} />
        </Box>
      )}

      {/* Linked interventions summary for reservations */}
      {isReservation && linkedInterventions.length > 0 && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
            Interventions liées ({linkedInterventions.length})
          </Typography>
          {linkedInterventions.map((li) => {
            const steps = new Set((li.completedSteps || '').split(',').filter(Boolean));
            const inspDone = steps.has('inspection');
            const roomsDone = steps.has('rooms');
            const photosDone = steps.has('after_photos');
            const progress = (inspDone ? 33 : 0) + (roomsDone ? 33 : 0) + (photosDone ? 34 : 0);
            const isInProgress = ['in_progress', 'awaiting_validation'].includes(li.status);
            const isDone = li.status === 'completed' || li.status === 'awaiting_validation';

            return (
              <Box
                key={li.id}
                onClick={() => onNavigate?.({ type: 'intervention-detail', interventionId: li.id })}
                sx={{
                  mb: 0.75,
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: onNavigate ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  '&:hover': onNavigate ? {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                    '& .drill-arrow': { opacity: 1, transform: 'translateX(2px)' },
                  } : {},
                }}
              >
                {/* Header row: icon + title + arrow */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                  {li.type === 'cleaning' ? (
                    <AutoAwesome sx={{ fontSize: 14, color: '#9B7FC4' }} />
                  ) : (
                    <Handyman sx={{ fontSize: 14, color: '#7EBAD0' }} />
                  )}
                  <Typography variant="caption" sx={{ flex: 1, fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {li.title} — {li.assigneeName}
                  </Typography>
                  <ChevronRight
                    className="drill-arrow"
                    sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.4, transition: 'all 0.15s ease' }}
                  />
                </Box>

                {/* Progress bar */}
                {isInProgress && (
                  <Box sx={{ mb: 0.75 }}>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: 'action.hover',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 2,
                          backgroundColor: progress === 100 ? 'success.main' : 'primary.main',
                        },
                      }}
                    />
                  </Box>
                )}

                {/* Mini steps row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {[
                    { done: inspDone, icon: <InspectIcon sx={{ fontSize: 11 }} />, label: 'Inspection' },
                    { done: roomsDone, icon: <MeetingRoom sx={{ fontSize: 11 }} />, label: 'Pièces' },
                    { done: photosDone, icon: <CameraAlt sx={{ fontSize: 11 }} />, label: 'Photos' },
                  ].map((step, idx) => {
                    const c = step.done ? '#4A9B8E' : '#757575';
                    return (
                    <Chip
                      key={idx}
                      icon={step.done ? <CheckCircle sx={{ fontSize: 11, color: `${c} !important` }} /> : React.cloneElement(step.icon, { sx: { fontSize: 11, color: `${c} !important` } })}
                      label={step.label}
                      size="small"
                      sx={{
                        fontSize: '0.5625rem',
                        height: 20,
                        fontWeight: 600,
                        backgroundColor: `${c}18`,
                        color: c,
                        border: `1px solid ${c}40`,
                        borderRadius: '6px',
                        '& .MuiChip-icon': { fontSize: 11, ml: 0.25 },
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                    );
                  })}
                  {isDone && (
                    <Chip
                      label="Terminée"
                      size="small"
                      sx={{ fontSize: '0.5625rem', height: 20, ml: 'auto', fontWeight: 600, backgroundColor: '#4A9B8E18', color: '#4A9B8E', border: '1px solid #4A9B8E40', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
                    />
                  )}
                  {!isDone && li.status === 'scheduled' && (
                    <Chip
                      label="Planifiée"
                      size="small"
                      sx={{ fontSize: '0.5625rem', height: 20, ml: 'auto', fontWeight: 600, backgroundColor: '#0288d118', color: '#0288d1', border: '1px solid #0288d140', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
                    />
                  )}
                </Box>
              </Box>
            );
          })}
          <Divider sx={{ mt: 1, mb: 0.5 }} />
        </Box>
      )}

      {/* ── Reservation view: Service request buttons ─────────────────────── */}
      {isReservation && (
        <>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
              Demandes de service
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CleaningServices sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={handleCleaningRequestClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Demande de ménage
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Handyman sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={handleMaintenanceRequestClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Demande de maintenance
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={handleNewServiceRequestClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Nouvelle demande de service
              </Button>
            </Box>
          </Box>

          {/* Linked service requests */}
          {(serviceRequests && serviceRequests.length > 0) && (
            <>
              <Divider />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
                  Demandes liées ({serviceRequests.length})
                </Typography>
                {serviceRequests.map((sr) => {
                  const statusCfg = SR_STATUS_CONFIG[sr.status] || { label: sr.status, color: '#757575' };
                  const typeLabel = SERVICE_TYPE_LABELS[sr.serviceType] || sr.serviceType;
                  return (
                    <Box
                      key={sr.id}
                      onClick={() => navigate(`/service-requests/${sr.id}`)}
                      sx={{
                        mb: 0.75,
                        p: 1,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                          borderColor: 'primary.main',
                          '& .sr-arrow': { opacity: 1, transform: 'translateX(2px)' },
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Send sx={{ fontSize: 12, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ flex: 1, fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sr.title}
                        </Typography>
                        <OpenInNew
                          className="sr-arrow"
                          sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.4, transition: 'all 0.15s ease' }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={typeLabel}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem',
                            height: 20,
                            fontWeight: 600,
                            backgroundColor: '#75757518',
                            color: '#757575',
                            border: '1px solid #75757540',
                            borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                        <Chip
                          label={statusCfg.label}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem',
                            height: 20,
                            fontWeight: 600,
                            backgroundColor: `${statusCfg.color}18`,
                            color: statusCfg.color,
                            border: `1px solid ${statusCfg.color}40`,
                            borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </>
      )}

      {/* ── Intervention view: Actions (assign, priority, checklist, alerts) ── */}
      {!isReservation && intervention && (
        <>
          <Divider />

          {/* Assignment */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
              Assignation
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Groups sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={handleAssignClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Assigner equipe / prestataire
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PriorityHigh sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={handlePriorityClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Definir priorite
              </Button>
            </Box>
          </Box>

          <Divider />

          {/* Checklist & alerts */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
              Suivi
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CheckCircleOutline sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={() => {
                  if (!targetIntervention) {
                    showSnackbar('Aucune intervention.', 'error');
                    return;
                  }
                  // Parse existing checklist from notes
                  const existingChecklist = targetIntervention.notes?.match(/--- Checklist ---\n([\s\S]*?)$/);
                  if (existingChecklist) {
                    const items = existingChecklist[1].split('\n').filter(Boolean).map((line) => ({
                      text: line.replace(/^\[.\] /, ''),
                      checked: line.startsWith('[x]'),
                    }));
                    setChecklistItems(items);
                  } else {
                    setChecklistItems(DEFAULT_CHECKLIST.map((text) => ({ text, checked: false })));
                  }
                  setChecklistOpen(true);
                }}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Ajouter checklist operationnelle
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<NotificationsActive sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={() => {
                  if (!targetIntervention) {
                    showSnackbar('Aucune intervention.', 'error');
                    return;
                  }
                  setAlertDate(targetIntervention.startDate || today);
                  setAlertTime('09:00');
                  setAlertMessage('');
                  setAlertDialogOpen(true);
                }}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Ajouter alerte / rappel
              </Button>
            </Box>
          </Box>
        </>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Create Service Request Dialog */}
      <CreateServiceRequestDialog
        open={srDialogOpen}
        onClose={() => setSrDialogOpen(false)}
        propertyId={propertyId}
        propertyName={propertyName}
        defaultServiceType={srDialogDefaultType}
        defaultDesiredDate={isReservation ? reservation?.checkOut : intervention?.startDate}
        onCreated={() => {
          showSnackbar('Demande de service créée avec succès');
          onServiceRequestCreated?.();
        }}
      />

      {/* Assign Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Groups sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Assigner intervention
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAssignDialogOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {assignTarget && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Intervention : <strong>{assignTarget.title}</strong>
            </Typography>
          )}

          {/* Auto-assign toggle (only visible if feature enabled in settings) */}
          {autoAssignEnabled && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                mb: 1.5,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: assignAutoMode ? 'primary.main' : 'divider',
                backgroundColor: assignAutoMode ? 'primary.50' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoFixHigh sx={{ fontSize: 18, color: assignAutoMode ? 'primary.main' : 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.2 }}>
                    Assignation automatique
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                    Selectionne le membre le moins charge
                  </Typography>
                </Box>
              </Box>
              <Switch
                size="small"
                checked={assignAutoMode}
                onChange={(e) => handleAutoAssignToggle(e.target.checked)}
              />
            </Box>
          )}

          {/* Auto-assign suggestion info */}
          {assignAutoMode && autoAssignSuggestion && (
            <Alert
              severity="info"
              icon={<AutoFixHigh sx={{ fontSize: 18 }} />}
              sx={{ fontSize: '0.75rem', mb: 1.5, '& .MuiAlert-message': { py: 0.25 } }}
            >
              <strong>{autoAssignSuggestion.name}</strong> — {autoAssignSuggestion.reason}
            </Alert>
          )}

          <TextField
            select
            label="Assigner a"
            value={assignValue}
            onChange={(e) => {
              setAssignValue(e.target.value);
              // If user manually changes, turn off auto mode
              if (assignAutoMode && autoAssignSuggestion && e.target.value !== autoAssignSuggestion.name) {
                setAssignAutoMode(false);
              }
            }}
            size="small"
            fullWidth
            disabled={assignAutoMode}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          >
            {STAFF_OPTIONS.map((name) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </TextField>
          {assignError && (
            <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1.5 }}>
              {assignError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setAssignDialogOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleAssignConfirm}
            variant="contained"
            size="small"
            disabled={!assignValue || assignLoading}
            startIcon={assignLoading ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Priority Dialog */}
      <Dialog
        open={priorityDialogOpen}
        onClose={() => setPriorityDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PriorityHigh sx={{ fontSize: 20, color: 'warning.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Definir la priorite
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPriorityDialogOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {priorityTarget && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 2, display: 'block' }}>
              Intervention : <strong>{priorityTarget.title}</strong>
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            {PRIORITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={priorityValue === opt.value ? 'contained' : 'outlined'}
                size="small"
                fullWidth
                onClick={() => setPriorityValue(opt.value)}
                sx={{
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  borderColor: opt.color,
                  color: priorityValue === opt.value ? '#fff' : opt.color,
                  backgroundColor: priorityValue === opt.value ? opt.color : 'transparent',
                  '&:hover': {
                    backgroundColor: priorityValue === opt.value ? opt.color : `${opt.color}14`,
                    borderColor: opt.color,
                  },
                }}
              >
                {opt.label}
              </Button>
            ))}
          </Box>
          {priorityError && (
            <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1.5 }}>
              {priorityError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setPriorityDialogOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handlePriorityConfirm}
            variant="contained"
            size="small"
            disabled={priorityLoading}
            startIcon={priorityLoading ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Checklist Dialog */}
      <Dialog
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutline sx={{ fontSize: 20, color: 'success.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Checklist operationnelle
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setChecklistOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 0, pb: 0 }}>
          <List dense disablePadding>
            {checklistItems.map((item, index) => (
              <ListItem
                key={index}
                disablePadding
                sx={{ py: 0.25 }}
                secondaryAction={
                  <Checkbox
                    edge="end"
                    checked={item.checked}
                    onChange={() => handleChecklistToggle(index)}
                    size="small"
                  />
                }
              >
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.8125rem',
                    sx: {
                      textDecoration: item.checked ? 'line-through' : 'none',
                      color: item.checked ? 'text.disabled' : 'text.primary',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setChecklistOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Fermer
          </Button>
          <Button
            onClick={handleChecklistSave}
            variant="contained"
            size="small"
            disabled={checklistSaving}
            startIcon={checklistSaving ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alert / Reminder Dialog */}
      <Dialog
        open={alertDialogOpen}
        onClose={() => setAlertDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsActive sx={{ fontSize: 20, color: 'info.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Ajouter un rappel
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAlertDialogOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <TextField
              type="date"
              label="Date du rappel"
              value={alertDate}
              onChange={(e) => setAlertDate(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              type="time"
              label="Heure"
              value={alertTime}
              onChange={(e) => setAlertTime(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>
          <TextField
            label="Message du rappel"
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Ex: Verifier la livraison du linge..."
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setAlertDialogOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleAlertSave}
            variant="contained"
            size="small"
            disabled={!alertDate || !alertMessage.trim() || alertSaving}
            startIcon={alertSaving ? <CircularProgress size={14} /> : <NotificationsActive sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Ajouter rappel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ fontSize: '0.8125rem' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PanelOperations;
