import React, { useState, useMemo } from 'react';
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
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { useWorkflowSettings } from '../../../hooks/useWorkflowSettings';
import CreateInterventionDialog from './CreateInterventionDialog';

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

interface PanelOperationsProps {
  event: PlanningEvent;
  allEvents?: PlanningEvent[];
  interventions?: PlanningIntervention[];
  onCreateAutoCleaning?: (reservationId: number) => Promise<{ success: boolean; error: string | null }>;
  onCreateIntervention?: (data: {
    propertyId: number;
    propertyName: string;
    type: 'cleaning' | 'maintenance';
    title: string;
    assigneeName: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    estimatedDurationHours: number;
    notes?: string;
    linkedReservationId?: number;
  }) => Promise<{ success: boolean; error: string | null }>;
  onAssignIntervention?: (interventionId: number, assigneeName: string) => Promise<{ success: boolean; error: string | null }>;
  onSetPriority?: (interventionId: number, priority: 'normale' | 'haute' | 'urgente') => Promise<{ success: boolean; error: string | null }>;
  onUpdateInterventionNotes?: (interventionId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
}

const PanelOperations: React.FC<PanelOperationsProps> = ({
  event,
  allEvents,
  interventions,
  onCreateAutoCleaning,
  onCreateIntervention,
  onAssignIntervention,
  onSetPriority,
  onUpdateInterventionNotes,
}) => {
  const isReservation = event.type === 'reservation';
  const intervention = event.intervention;
  const reservation = event.reservation;

  // ── Workflow settings (auto-assign feature flag) ───────────────────────────
  const { settings: workflowSettings } = useWorkflowSettings();
  const autoAssignEnabled = workflowSettings.autoAssignInterventions;

  // ── Dialog states ──────────────────────────────────────────────────────────
  const [autoCleaningLoading, setAutoCleaningLoading] = useState(false);
  const [autoCleaningError, setAutoCleaningError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogType, setCreateDialogType] = useState<'cleaning' | 'maintenance'>('maintenance');

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

  // 1. Planifier menage automatique
  const handleAutoCleaningClick = async () => {
    if (!reservation || !onCreateAutoCleaning) return;
    setAutoCleaningLoading(true);
    setAutoCleaningError(null);
    const result = await onCreateAutoCleaning(reservation.id);
    setAutoCleaningLoading(false);
    if (result.success) {
      showSnackbar('Menage automatique planifie avec succes');
    } else {
      setAutoCleaningError(result.error);
    }
  };

  // 2. Planifier maintenance → open CreateInterventionDialog with type='maintenance'
  const handleMaintenanceClick = () => {
    setCreateDialogType('maintenance');
    setCreateDialogOpen(true);
  };

  // 3. Creer intervention personnalisee → open CreateInterventionDialog
  const handleCustomInterventionClick = () => {
    setCreateDialogType('maintenance');
    setCreateDialogOpen(true);
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
            <Chip label={intervention.status} size="small" variant="outlined" sx={{ fontSize: '0.625rem' }} />
            <Chip label={intervention.assigneeName} size="small" variant="outlined" sx={{ fontSize: '0.625rem' }} />
            {intervention.estimatedDurationHours && (
              <Chip label={`${intervention.estimatedDurationHours}h`} size="small" variant="outlined" sx={{ fontSize: '0.625rem' }} />
            )}
          </Box>
          {intervention.notes && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-line' }}>
              {intervention.notes}
            </Typography>
          )}
          <Divider sx={{ my: 1 }} />
        </Box>
      )}

      {/* Linked interventions summary for reservations */}
      {isReservation && linkedInterventions.length > 0 && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
            Interventions liees ({linkedInterventions.length})
          </Typography>
          {linkedInterventions.map((li) => (
            <Box key={li.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              {li.type === 'cleaning' ? (
                <AutoAwesome sx={{ fontSize: 14, color: '#9B7FC4' }} />
              ) : (
                <Handyman sx={{ fontSize: 14, color: '#7EBAD0' }} />
              )}
              <Typography variant="caption" sx={{ fontSize: '0.6875rem' }}>
                {li.title} — {li.assigneeName}
              </Typography>
              <Chip label={li.status} size="small" sx={{ fontSize: '0.5625rem', height: 18 }} />
            </Box>
          ))}
          <Divider sx={{ mt: 1, mb: 0.5 }} />
        </Box>
      )}

      {/* Quick operation actions */}
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
          {isReservation ? 'Planifier' : 'Actions'}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {isReservation && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={autoCleaningLoading ? <CircularProgress size={14} /> : <AutoAwesome sx={{ fontSize: 14 }} />}
                fullWidth
                disabled={autoCleaningLoading}
                onClick={handleAutoCleaningClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Planifier menage automatique
              </Button>
              {autoCleaningError && (
                <Alert severity="error" sx={{ fontSize: '0.6875rem', py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                  {autoCleaningError}
                </Alert>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<Handyman sx={{ fontSize: 14 }} />}
                fullWidth
                onClick={handleMaintenanceClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Planifier maintenance
              </Button>
            </>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add sx={{ fontSize: 14 }} />}
            fullWidth
            onClick={handleCustomInterventionClick}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Creer intervention personnalisee
          </Button>
        </Box>
      </Box>

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
                showSnackbar('Aucune intervention. Creez d\'abord une intervention.', 'error');
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
                showSnackbar('Aucune intervention. Creez d\'abord une intervention.', 'error');
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

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Create Intervention Dialog */}
      <CreateInterventionDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        propertyId={propertyId}
        propertyName={propertyName}
        defaultType={createDialogType}
        linkedReservationId={isReservation ? reservation?.id : undefined}
        defaultStartDate={isReservation ? reservation?.checkOut : intervention?.startDate}
        defaultEndDate={isReservation ? reservation?.checkOut : intervention?.endDate}
        onConfirm={async (data) => {
          if (!onCreateIntervention) return { success: false, error: 'Non disponible' };
          const result = await onCreateIntervention(data);
          if (result.success) {
            showSnackbar('Intervention creee avec succes');
          }
          return result;
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
