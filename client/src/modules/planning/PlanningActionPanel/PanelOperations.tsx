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
  ListSubheader,
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
  Payment,
  PersonAdd,
  Visibility,
  VisibilityOff,
  Verified,
  HourglassEmpty,
  Person,
  DeleteOutline,
} from '../../../icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { managersApi } from '../../../services/api';
import type { PortfolioTeam, OperationalUser } from '../../../services/api';
import { interventionsApi } from '../../../services/api/interventionsApi';
import type { TeamMemberAvailability } from '../../../services/api/interventionsApi';
import { serviceRequestsApi } from '../../../services/api/serviceRequestsApi';
import type { ServiceRequest } from '../../../services/api/serviceRequestsApi';
import { useWorkflowSettings } from '../../../hooks/useWorkflowSettings';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import CreateServiceRequestDialog from './CreateServiceRequestDialog';

// ── Assignee option (user or team) ──────────────────────────────────────────
interface AssigneeOption {
  id: number;
  type: 'user' | 'team';
  label: string;        // Display name
  sublabel?: string;    // Role or intervention type
}

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
  PENDING: { label: "En attente d'assignation", color: '#F59E0B' },
  ASSIGNED: { label: 'Assignée', color: '#8B5CF6' },
  AWAITING_PAYMENT: { label: 'En attente de paiement', color: '#F59E0B' },
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

// ── Intervention payment status config ────────────────────────────────────────
const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Payé', color: '#4A9B8E' },
  PENDING: { label: 'En attente', color: '#ED6C02' },
  PROCESSING: { label: 'En cours', color: '#0288d1' },
  FAILED: { label: 'Échoué', color: '#d32f2f' },
  REFUNDED: { label: 'Remboursé', color: '#d32f2f' },
  CANCELLED: { label: 'Annulé', color: '#9e9e9e' },
};

// ── Intervention status labels ───────────────────────────────────────────────
const INTERVENTION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Planifiée', color: '#0288d1' },
  in_progress: { label: 'En cours', color: '#1976d2' },
  completed: { label: 'Terminée', color: '#4A9B8E' },
  cancelled: { label: 'Annulée', color: '#9e9e9e' },
  awaiting_validation: { label: 'Validation', color: '#F59E0B' },
  awaiting_payment: { label: 'Attente paiement', color: '#ED6C02' },
};

interface PanelOperationsProps {
  event: PlanningEvent;
  allEvents?: PlanningEvent[];
  interventions?: PlanningIntervention[];
  /** @deprecated — service requests are now self-fetched via useQuery inside PanelOperations */
  _serviceRequestsUnused?: ServiceRequest[];
  onAssignIntervention?: (interventionId: number, assigneeName: string, options?: { userId?: number; teamId?: number }) => Promise<{ success: boolean; error: string | null }>;
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
  onAssignIntervention,
  onSetPriority,
  onUpdateInterventionNotes,
  onUpdateInterventionDates,
  onServiceRequestCreated,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isReservation = event.type === 'reservation';
  const intervention = event.intervention;
  const reservation = event.reservation;

  // ── Role check: who can manually assign interventions / service requests ──
  // - SUPER_ADMIN / SUPER_MANAGER : toujours
  // - HOST B2B (conciergerie / société de ménage) : peut gérer ses équipes affiliées
  // - HOST propriétaire (INDIVIDUAL) : assignation automatique uniquement (plateforme)
  // - Org ADMIN : toujours
  const { user } = useAuth();
  const isB2bHost = user?.roles?.includes('HOST') &&
    (user?.organizationType === 'CONCIERGE' || user?.organizationType === 'CLEANING_COMPANY');
  const canEditIntervention =
    user?.roles?.some(r => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ||
    isB2bHost ||
    user?.orgRole === 'ADMIN';

  // ── Workflow settings (auto-assign feature flag) ───────────────────────────
  const { settings: workflowSettings } = useWorkflowSettings();
  const autoAssignEnabled = workflowSettings.autoAssignInterventions;

  // ── Fetch real teams and operational users for assignment ─────────────────
  const { data: teamsData } = useQuery({
    queryKey: ['planning', 'assign-teams'],
    queryFn: () => managersApi.getTeams(),
    enabled: canEditIntervention,
    staleTime: 5 * 60 * 1000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['planning', 'assign-users'],
    queryFn: () => managersApi.getOperationalUsers(),
    enabled: canEditIntervention,
    staleTime: 5 * 60 * 1000,
  });

  // ── Fetch service requests for the current reservation ─────────────────────
  const currentReservationId = isReservation ? reservation?.id : undefined;
  const { data: serviceRequestsRaw } = useQuery({
    queryKey: ['planning', 'service-requests', currentReservationId],
    queryFn: async () => {
      const result = await serviceRequestsApi.getAll({ reservationId: currentReservationId });
      // API returns paginated or array — handle both
      const list = (result as unknown as { content?: ServiceRequest[] }).content ?? result;
      return list as ServiceRequest[];
    },
    enabled: isReservation && !!currentReservationId,
    staleTime: 30_000,
  });
  const serviceRequests = serviceRequestsRaw ?? [];

  /** Unified assignee options list (users + teams) */
  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const options: AssigneeOption[] = [];
    // Add operational users
    const users = (usersData ?? []) as OperationalUser[];
    for (const u of users) {
      options.push({
        id: u.id,
        type: 'user',
        label: `${u.firstName} ${u.lastName}`,
        sublabel: u.role,
      });
    }
    // Add teams
    const teams = (teamsData ?? []) as PortfolioTeam[];
    for (const t of teams) {
      options.push({
        id: t.id,
        type: 'team',
        label: t.name,
        sublabel: t.interventionType,
      });
    }
    return options;
  }, [usersData, teamsData]);

  // ── Dialog states ──────────────────────────────────────────────────────────
  const [srDialogOpen, setSrDialogOpen] = useState(false);
  const [srDialogDefaultType, setSrDialogDefaultType] = useState<string | undefined>(undefined);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PlanningIntervention | null>(null);
  const [assignValue, setAssignValue] = useState('');  // composite key: "user-{id}" or "team-{id}"
  const [assignAutoMode, setAssignAutoMode] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberAvailability[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamAvailabilityInfo, setTeamAvailabilityInfo] = useState<{ allAvailable: boolean; teamName: string } | null>(null);
  const [teamAvailabilityError, setTeamAvailabilityError] = useState<string | null>(null);

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

  // ── Service request validation state ──────────────────────────────────────
  const [validatingId, setValidatingId] = useState<number | null>(null);

  // ── Unified assign dialog mode ──────────────────────────────────────────────
  // 'intervention' mode: assign a PlanningIntervention via onAssignIntervention
  // 'service_request' mode: assign a ServiceRequest via handleManualAssignSR
  const [assignMode, setAssignMode] = useState<'intervention' | 'service_request'>('intervention');
  const [assignSrTargetId, setAssignSrTargetId] = useState<number | null>(null);
  const [assignSrDesiredDate, setAssignSrDesiredDate] = useState<string | null>(null);
  const [assignSrDurationHours, setAssignSrDurationHours] = useState<number | undefined>(undefined);

  // ── Delete service request ───────────────────────────────────────────────
  const [deleteSrDialogOpen, setDeleteSrDialogOpen] = useState(false);
  const [deleteSrTarget, setDeleteSrTarget] = useState<ServiceRequest | null>(null);
  const [deleteSrLoading, setDeleteSrLoading] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const canDeleteSr = (sr: ServiceRequest): boolean => {
    if (['ASSIGNED', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'COMPLETED'].includes(sr.status)) return false;
    return canEditIntervention;
  };

  const handleDeleteSr = async () => {
    if (!deleteSrTarget) return;
    setDeleteSrLoading(true);
    try {
      await serviceRequestsApi.delete(Number(deleteSrTarget.id));
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      showSnackbar('Demande supprimée');
    } catch {
      showSnackbar('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteSrLoading(false);
      setDeleteSrDialogOpen(false);
      setDeleteSrTarget(null);
    }
  };

  /** Find interventions linked to this reservation */
  const linkedInterventions = isReservation && reservation
    ? (interventions || []).filter((i) => i.linkedReservationId === reservation.id && i.status !== 'cancelled')
    : [];

  /** The target intervention for assign / priority buttons */
  const targetIntervention = intervention || (linkedInterventions.length > 0 ? linkedInterventions[0] : null);

  /** Helper to build a composite key for an assignee option */
  const assigneeKey = (opt: AssigneeOption) => `${opt.type}-${opt.id}`;

  /** Find the assignee option matching a composite key */
  const findAssignee = (key: string): AssigneeOption | undefined =>
    assigneeOptions.find((o) => assigneeKey(o) === key);

  /**
   * Auto-assign suggestion: pick the staff member / team with the fewest
   * active interventions overlapping the target date range.
   * Works for both intervention mode (uses assignTarget dates) and SR mode (uses assignSrDesiredDate).
   */
  const autoAssignSuggestion = useMemo(() => {
    if (!autoAssignEnabled || assigneeOptions.length === 0) return null;

    // Determine target date range
    let targetStart: string | null = null;
    let targetEnd: string | null = null;
    let excludeId: number | null = null;

    if (assignMode === 'intervention' && assignTarget) {
      targetStart = assignTarget.startDate;
      targetEnd = assignTarget.endDate;
      excludeId = assignTarget.id;
    } else if (assignMode === 'service_request' && assignSrDesiredDate) {
      targetStart = assignSrDesiredDate;
      targetEnd = assignSrDesiredDate; // same day
    }

    if (!targetStart || !targetEnd) return null;

    const allInterventions = interventions || [];

    // Count overlapping interventions per assignee
    const workload = new Map<string, number>();
    for (const opt of assigneeOptions) {
      workload.set(assigneeKey(opt), 0);
    }

    for (const intv of allInterventions) {
      if (excludeId && intv.id === excludeId) continue;
      if (intv.status === 'cancelled') continue;
      // Check date overlap
      if (intv.startDate <= targetEnd && intv.endDate >= targetStart) {
        if (intv.assigneeName) {
          // Match by name (best effort — real data may vary)
          for (const opt of assigneeOptions) {
            if (opt.label === intv.assigneeName) {
              const key = assigneeKey(opt);
              workload.set(key, (workload.get(key) || 0) + 1);
            }
          }
        }
      }
    }

    // Sort by workload (ascending), pick the least busy
    const sorted = assigneeOptions.slice().sort(
      (a, b) => (workload.get(assigneeKey(a)) || 0) - (workload.get(assigneeKey(b)) || 0),
    );
    const best = sorted[0];
    const bestWorkload = workload.get(assigneeKey(best)) || 0;

    return {
      option: best,
      key: assigneeKey(best),
      name: best.label,
      overlappingCount: bestWorkload,
      reason: bestWorkload === 0
        ? 'Aucune intervention sur ce creneau'
        : `${bestWorkload} intervention${bestWorkload > 1 ? 's' : ''} sur ce creneau (le moins charge)`,
    };
  }, [assignTarget, assignMode, assignSrDesiredDate, interventions, autoAssignEnabled, assigneeOptions]);

  // ── Fetch team member availability when a team is selected ─────────────────
  // Works for both intervention mode (by interventionId) and SR mode (by date)
  useEffect(() => {
    if (!assignValue.startsWith('team-')) {
      setTeamMembers([]);
      setTeamAvailabilityInfo(null);
      setTeamAvailabilityError(null);
      return;
    }
    // In intervention mode, we need an assignTarget; in SR mode, we need a desired date
    if (assignMode === 'intervention' && !assignTarget) {
      setTeamMembers([]);
      setTeamAvailabilityInfo(null);
      setTeamAvailabilityError(null);
      return;
    }
    if (assignMode === 'service_request' && !assignSrDesiredDate) {
      setTeamMembers([]);
      setTeamAvailabilityInfo(null);
      setTeamAvailabilityError(null);
      return;
    }

    const teamId = Number(assignValue.replace('team-', ''));
    if (isNaN(teamId)) return;

    let cancelled = false;
    setTeamMembersLoading(true);
    setTeamAvailabilityError(null);

    const fetchPromise = assignMode === 'intervention' && assignTarget
      ? interventionsApi.checkTeamAvailability(teamId, assignTarget.id)
      : interventionsApi.checkTeamAvailabilityByDate(teamId, assignSrDesiredDate!, assignSrDurationHours);

    fetchPromise
      .then((data) => {
        if (cancelled) return;
        setTeamMembers(data.members || []);
        setTeamAvailabilityInfo({ allAvailable: data.allAvailable, teamName: data.teamName });
        setTeamAvailabilityError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setTeamMembers([]);
        setTeamAvailabilityInfo(null);
        const msg = err instanceof Error ? err.message : 'Erreur lors du chargement';
        setTeamAvailabilityError(msg);
      })
      .finally(() => {
        if (!cancelled) setTeamMembersLoading(false);
      });

    return () => { cancelled = true; };
  }, [assignValue, assignTarget, assignMode, assignSrDesiredDate, assignSrDurationHours]);

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

  // 3b. Payer une demande de service — le paiement est gere par PanelFinancial (onglet Paiement)
  // via le PaymentCheckoutModal embedded. Cette fonction n'est plus utilisee ici.

  // 3c-bis. Refuser une assignation (assigné peut refuser)
  const handleRefuseServiceRequest = async (srId: number) => {
    setValidatingId(srId);
    try {
      await serviceRequestsApi.refuse(srId);
      showSnackbar('Assignation refusee — re-assignation en cours');
      queryClient.invalidateQueries({ queryKey: ['planning', 'service-requests', currentReservationId] });
      queryClient.invalidateQueries({ queryKey: ['planning-page'] });
      onServiceRequestCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du refus';
      showSnackbar(msg, 'error');
    } finally {
      setValidatingId(null);
    }
  };

  // 3d. Assignation manuelle par admin/manager
  const handleManualAssignSR = async (srId: number, assignedToId: number, assignedToType: 'user' | 'team') => {
    setValidatingId(srId);
    try {
      await serviceRequestsApi.manualAssign(srId, assignedToId, assignedToType);
      showSnackbar('Demande assignee avec succes');
      queryClient.invalidateQueries({ queryKey: ['planning', 'service-requests', currentReservationId] });
      queryClient.invalidateQueries({ queryKey: ['planning-page'] });
      onServiceRequestCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'assignation';
      showSnackbar(msg, 'error');
    } finally {
      setValidatingId(null);
    }
  };

  // 3e. Open unified assign dialog for a service request
  const handleOpenSrAssignDialog = (sr: ServiceRequest) => {
    setAssignMode('service_request');
    setAssignSrTargetId(sr.id);
    setAssignSrDesiredDate(sr.desiredDate ? sr.desiredDate.split('T')[0] : null);
    setAssignSrDurationHours(sr.estimatedDurationHours || undefined);
    setAssignTarget(null); // no intervention target in SR mode
    setAssignValue('');
    setAssignAutoMode(false);
    setAssignError(null);
    setAssignDialogOpen(true);
  };

  // 3f. Open assign dialog for a specific intervention (from intervention card)
  const handleAssignFromCard = (intv: PlanningIntervention) => {
    setAssignMode('intervention');
    setAssignSrTargetId(null);
    setAssignSrDesiredDate(null);
    setAssignSrDurationHours(undefined);
    setAssignTarget(intv);
    // Try to find the currently assigned person in options by matching name
    const existingOption = assigneeOptions.find((o) => o.label === intv.assigneeName);
    setAssignValue(existingOption ? assigneeKey(existingOption) : '');
    setAssignAutoMode(false);
    setAssignError(null);
    setAssignDialogOpen(true);
  };

  // 4. Assigner equipe / prestataire
  const handleAssignClick = () => {
    if (!targetIntervention) {
      showSnackbar('Aucune intervention a assigner. Creez d\'abord une intervention.', 'error');
      return;
    }
    setAssignMode('intervention');
    setAssignSrTargetId(null);
    setAssignSrDesiredDate(null);
    setAssignSrDurationHours(undefined);
    setAssignTarget(targetIntervention);
    // Try to find the currently assigned person in options by matching name
    const existingOption = assigneeOptions.find((o) => o.label === targetIntervention.assigneeName);
    setAssignValue(existingOption ? assigneeKey(existingOption) : '');
    setAssignAutoMode(false);
    setAssignError(null);
    setAssignDialogOpen(true);
  };

  /** When auto-assign toggle changes, auto-fill the best suggestion */
  const handleAutoAssignToggle = (checked: boolean) => {
    setAssignAutoMode(checked);
    if (checked && autoAssignSuggestion) {
      setAssignValue(autoAssignSuggestion.key);
    }
  };

  const handleAssignConfirm = async () => {
    if (!assignValue) return;
    const selected = findAssignee(assignValue);
    if (!selected) return;

    setAssignLoading(true);
    setAssignError(null);

    if (assignMode === 'service_request' && assignSrTargetId) {
      // SR mode: call manualAssign
      await handleManualAssignSR(assignSrTargetId, selected.id, selected.type);
      setAssignLoading(false);
      setAssignDialogOpen(false);
    } else if (assignMode === 'intervention' && assignTarget && onAssignIntervention) {
      // Intervention mode: call onAssignIntervention
      const options = selected.type === 'user'
        ? { userId: selected.id }
        : { teamId: selected.id };

      const result = await onAssignIntervention(assignTarget.id, selected.label, options);
      setAssignLoading(false);
      if (result.success) {
        setAssignDialogOpen(false);
        showSnackbar(`Intervention assignée à ${selected.label}`);
      } else {
        setAssignError(result.error);
      }
    } else {
      setAssignLoading(false);
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
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><CalendarMonth size={18} strokeWidth={1.75} /></Box>
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, fontSize: '0.8125rem' }}>
            Dates & Horaires
          </Typography>
          {!editing ? (
            <IconButton size="small" onClick={() => setEditing(true)} sx={{ p: 0.25 }}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Edit size={14} strokeWidth={1.75} /></Box>
            </IconButton>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                sx={{ p: 0.25, color: 'success.main' }}
              >
                {saving ? <CircularProgress size={14} /> : <Check size={16} strokeWidth={1.75} />}
              </IconButton>
              <IconButton size="small" onClick={handleCancel} sx={{ p: 0.25, color: 'error.main' }}>
                <Close size={16} strokeWidth={1.75} />
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
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Schedule size={12} strokeWidth={1.75} /></Box>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    {intv.startTime}
                  </Typography>
                </Box>
              )}
            </Box>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><SwapHoriz  /></Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Fin</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                {intv.endDate}
              </Typography>
              {intv.endTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, justifyContent: 'flex-end' }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Schedule size={12} strokeWidth={1.75} /></Box>
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
              <AutoAwesome size={20} strokeWidth={1.75} color='#9B7FC4' />
            ) : (
              <Handyman size={20} strokeWidth={1.75} color='#7EBAD0' />
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

      {/* ── Reservation view: Full operations lifecycle ─────────────────────── */}
      {isReservation && (
        <>
          {/* Service request creation buttons */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
              Demandes de service
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CleaningServices size={14} strokeWidth={1.75} />}
                fullWidth
                onClick={handleCleaningRequestClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Demande de menage
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Handyman size={14} strokeWidth={1.75} />}
                fullWidth
                onClick={handleMaintenanceRequestClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Demande de maintenance
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add size={14} strokeWidth={1.75} />}
                fullWidth
                onClick={handleNewServiceRequestClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Nouvelle demande de service
              </Button>
            </Box>
          </Box>

          {/* Linked service requests with full lifecycle */}
          {(serviceRequests && serviceRequests.length > 0) && (
            <>
              <Divider />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
                  Demandes liees ({serviceRequests.length})
                </Typography>
                {serviceRequests.map((sr) => {
                  const statusCfg = SR_STATUS_CONFIG[sr.status] || { label: sr.status, color: '#757575' };
                  const typeLabel = SERVICE_TYPE_LABELS[sr.serviceType] || sr.serviceType;
                  const isReadyForPayment = sr.status === 'AWAITING_PAYMENT';
                  const isPending = sr.status === 'PENDING';
                  const isValidating = validatingId === sr.id;
                  const assigneeName = sr.assignedToTeam?.name
                    || (sr.assignedToUser ? `${sr.assignedToUser.firstName} ${sr.assignedToUser.lastName}` : null)
                    || sr.assignedToName;
                  return (
                    <Box
                      key={sr.id}
                      sx={{
                        mb: 0.75,
                        p: 1,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Header: title + open link */}
                      <Box
                        onClick={() => navigate(`/service-requests/${sr.id}`)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5,
                          cursor: 'pointer',
                          '&:hover .sr-arrow': { opacity: 1, transform: 'translateX(2px)' },
                        }}
                      >
                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Send size={12} strokeWidth={1.75} /></Box>
                        <Typography variant="caption" sx={{ flex: 1, fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sr.title}
                        </Typography>
                        <Box
                          component="span"
                          className="sr-arrow"
                          sx={{ display: 'inline-flex', color: 'text.secondary', opacity: 0.4, transition: 'all 0.15s ease' }}
                        >
                          <OpenInNew size={14} strokeWidth={1.75} />
                        </Box>
                      </Box>
                      {/* Status chips row */}
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={typeLabel}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 20, fontWeight: 600,
                            backgroundColor: '#75757518', color: '#757575',
                            border: '1px solid #75757540', borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                        <Chip
                          label={statusCfg.label}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 20, fontWeight: 600,
                            backgroundColor: `${statusCfg.color}18`, color: statusCfg.color,
                            border: `1px solid ${statusCfg.color}40`, borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                        {assigneeName && (
                          <Chip
                            icon={<Groups size={10} strokeWidth={1.75} color="#0288d1" />}
                            label={assigneeName}
                            size="small"
                            sx={{
                              fontSize: '0.5625rem', height: 20, fontWeight: 600,
                              backgroundColor: '#0288d118', color: '#0288d1',
                              border: '1px solid #0288d140', borderRadius: '6px',
                              '& .MuiChip-icon': { fontSize: 10, ml: 0.25 },
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        )}
                      </Box>
                      {/* Actions selon le statut */}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {/* PENDING sans assigné: Bouton assignation manuelle (admin/manager) ou message d'attente */}
                        {isPending && !assigneeName && canEditIntervention && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<PersonAdd size={14} strokeWidth={1.75} />}
                            disabled={isValidating}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSrAssignDialog(sr);
                            }}
                            sx={{
                              fontSize: '0.6875rem', textTransform: 'none',
                              py: 0.25, px: 1.5, borderRadius: 1,
                            }}
                          >
                            Assigner
                          </Button>
                        )}
                        {isPending && !assigneeName && !canEditIntervention && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {sr.autoAssignStatus === 'searching' && (
                              <>
                                <CircularProgress size={10} sx={{ color: 'text.secondary' }} />
                                <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                  Recherche en cours...
                                </Typography>
                              </>
                            )}
                            {sr.autoAssignStatus === 'exhausted' && (
                              <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'warning.main', fontStyle: 'italic' }}>
                                Aucune equipe disponible — assignation manuelle requise
                              </Typography>
                            )}
                            {(!sr.autoAssignStatus || sr.autoAssignStatus === 'found') && (
                              <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                En attente d&apos;assignation
                              </Typography>
                            )}
                          </Box>
                        )}
                        {/* Admin indicator for auto-assign status */}
                        {isPending && !assigneeName && canEditIntervention && sr.autoAssignStatus === 'exhausted' && (
                          <Alert severity="warning" sx={{ py: 0, px: 0.5, fontSize: '0.6rem', '& .MuiAlert-icon': { fontSize: '0.75rem', py: 0, mr: 0.5 }, '& .MuiAlert-message': { py: 0.25 } }}>
                            Aucune equipe dispo — assignation manuelle requise
                          </Alert>
                        )}
                        {isPending && !assigneeName && canEditIntervention && sr.autoAssignStatus === 'searching' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CircularProgress size={10} sx={{ color: 'text.secondary' }} />
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontStyle: 'italic' }}>
                              Recherche auto...
                            </Typography>
                          </Box>
                        )}
                        {/* PENDING avec assigné: bouton Reassigner (admin/manager) */}
                        {isPending && assigneeName && canEditIntervention && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PersonAdd size={14} strokeWidth={1.75} />}
                            disabled={isValidating}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSrAssignDialog(sr);
                            }}
                            sx={{
                              fontSize: '0.6875rem', textTransform: 'none',
                              py: 0.25, px: 1.5, borderRadius: 1,
                            }}
                          >
                            Réassigner
                          </Button>
                        )}
                        {/* AWAITING_PAYMENT: bouton Reassigner (admin/manager) */}
                        {sr.status === 'AWAITING_PAYMENT' && canEditIntervention && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PersonAdd size={14} strokeWidth={1.75} />}
                            disabled={isValidating}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSrAssignDialog(sr);
                            }}
                            sx={{
                              fontSize: '0.6875rem', textTransform: 'none',
                              py: 0.25, px: 1.5, borderRadius: 1,
                            }}
                          >
                            Réassigner
                          </Button>
                        )}
                        {/* Supprimer (PENDING, REJECTED, CANCELLED uniquement) */}
                        {canDeleteSr(sr) && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteSrTarget(sr);
                              setDeleteSrDialogOpen(true);
                            }}
                            sx={{ color: 'error.main', ml: 'auto', p: 0.5 }}
                          >
                            <DeleteOutline size={16} strokeWidth={1.75} />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}

          {/* All interventions linked to this reservation (full lifecycle view) */}
          {linkedInterventions.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
                  Interventions ({linkedInterventions.length})
                </Typography>
                {linkedInterventions.map((li) => {
                  const isAssigned = !!li.assigneeName;
                  const cost = li.actualCost || li.estimatedCost || 0;
                  const isPaid = li.paymentStatus === 'PAID';
                  const noCost = cost <= 0;
                  const isOnPlanning = isAssigned && (isPaid || noCost);
                  const statusCfg = INTERVENTION_STATUS_CONFIG[li.status] || { label: li.status, color: '#757575' };
                  const payStatusCfg = li.paymentStatus
                    ? (PAYMENT_STATUS_CONFIG[li.paymentStatus] || { label: li.paymentStatus, color: '#757575' })
                    : null;

                  const steps = new Set((li.completedSteps || '').split(',').filter(Boolean));
                  const inspDone = steps.has('inspection');
                  const roomsDone = steps.has('rooms');
                  const photosDone = steps.has('after_photos');
                  const progress = (inspDone ? 33 : 0) + (roomsDone ? 33 : 0) + (photosDone ? 34 : 0);
                  const isInProgress = ['in_progress', 'awaiting_validation'].includes(li.status);

                  return (
                    <Box
                      key={li.id}
                      sx={{
                        mb: 0.75,
                        p: 1,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: isOnPlanning ? '#4A9B8E40' : 'divider',
                        backgroundColor: isOnPlanning ? '#4A9B8E06' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Header: icon + title + drill arrow */}
                      <Box
                        onClick={() => onNavigate?.({ type: 'intervention-detail', interventionId: li.id })}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75,
                          cursor: onNavigate ? 'pointer' : 'default',
                          '&:hover .drill-arrow': { opacity: 1, transform: 'translateX(2px)' },
                        }}
                      >
                        {li.type === 'cleaning' ? (
                          <AutoAwesome size={14} strokeWidth={1.75} color='#9B7FC4' />
                        ) : (
                          <Handyman size={14} strokeWidth={1.75} color='#7EBAD0' />
                        )}
                        <Typography variant="caption" sx={{ flex: 1, fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {li.title}
                        </Typography>
                        <Box
                          component="span"
                          className="drill-arrow"
                          sx={{ display: 'inline-flex', color: 'text.secondary', opacity: 0.4, transition: 'all 0.15s ease' }}
                        >
                          <ChevronRight size={16} strokeWidth={1.75} />
                        </Box>
                      </Box>

                      {/* Status chips row */}
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={statusCfg.label}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 20, fontWeight: 600,
                            backgroundColor: `${statusCfg.color}18`, color: statusCfg.color,
                            border: `1px solid ${statusCfg.color}40`, borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                        {/* Assignment status */}
                        <Chip
                          icon={isAssigned
                            ? <CheckCircle size={10} strokeWidth={1.75} color="#4A9B8E" />
                            : <HourglassEmpty size={10} strokeWidth={1.75} color="#ED6C02" />}
                          label={isAssigned ? li.assigneeName : 'Non assigne'}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 20, fontWeight: 600,
                            backgroundColor: isAssigned ? '#4A9B8E18' : '#ED6C0218',
                            color: isAssigned ? '#4A9B8E' : '#ED6C02',
                            border: `1px solid ${isAssigned ? '#4A9B8E40' : '#ED6C0240'}`,
                            borderRadius: '6px',
                            '& .MuiChip-icon': { fontSize: 10, ml: 0.25 },
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                        {/* Payment status (only if cost > 0) */}
                        {cost > 0 && payStatusCfg && (
                          <Chip
                            icon={<Payment size={10} strokeWidth={1.75} color={payStatusCfg.color} />}
                            label={`${payStatusCfg.label} (${cost.toFixed(0)}€)`}
                            size="small"
                            sx={{
                              fontSize: '0.5625rem', height: 20, fontWeight: 600,
                              backgroundColor: `${payStatusCfg.color}18`, color: payStatusCfg.color,
                              border: `1px solid ${payStatusCfg.color}40`, borderRadius: '6px',
                              '& .MuiChip-icon': { fontSize: 10, ml: 0.25 },
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        )}
                        {/* Planning visibility indicator */}
                        <Tooltip title={isOnPlanning ? 'Visible sur le planning' : 'Non visible sur le planning (attribution et paiement requis)'}>
                          <Chip
                            icon={isOnPlanning
                              ? <Visibility size={10} strokeWidth={1.75} color="#4A9B8E" />
                              : <VisibilityOff size={10} strokeWidth={1.75} color="#9e9e9e" />}
                            label={isOnPlanning ? 'Planning' : 'Masque'}
                            size="small"
                            sx={{
                              fontSize: '0.5625rem', height: 20, fontWeight: 600,
                              backgroundColor: isOnPlanning ? '#4A9B8E18' : '#9e9e9e18',
                              color: isOnPlanning ? '#4A9B8E' : '#9e9e9e',
                              border: `1px solid ${isOnPlanning ? '#4A9B8E40' : '#9e9e9e40'}`,
                              borderRadius: '6px',
                              '& .MuiChip-icon': { fontSize: 10, ml: 0.25 },
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        </Tooltip>
                      </Box>

                      {/* Progress bar (if in progress) */}
                      {isInProgress && (
                        <Box sx={{ mb: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                              height: 4, borderRadius: 2, backgroundColor: 'action.hover',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 2,
                                backgroundColor: progress === 100 ? 'success.main' : 'primary.main',
                              },
                            }}
                          />
                        </Box>
                      )}

                      {/* Action: Assign button if not assigned */}
                      {!isAssigned && canEditIntervention && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PersonAdd size={12} strokeWidth={1.75} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignFromCard(li);
                          }}
                          sx={{
                            fontSize: '0.6875rem', textTransform: 'none', mt: 0.5,
                            py: 0.25, px: 1.5, borderRadius: 1,
                          }}
                        >
                          Assigner un prestataire
                        </Button>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}

          {/* Empty state when no service requests and no interventions */}
          {(!serviceRequests || serviceRequests.length === 0) && linkedInterventions.length === 0 && (
            <Alert severity="info" sx={{ fontSize: '0.75rem', '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
              Aucune demande de service ou intervention pour cette reservation. Utilisez les boutons ci-dessus pour creer une demande.
            </Alert>
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
                startIcon={<Groups size={14} strokeWidth={1.75} />}
                fullWidth
                onClick={handleAssignClick}
                sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Assigner equipe / prestataire
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PriorityHigh size={14} strokeWidth={1.75} />}
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
                startIcon={<CheckCircleOutline size={14} strokeWidth={1.75} />}
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
                startIcon={<NotificationsActive size={14} strokeWidth={1.75} />}
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
        reservationId={currentReservationId}
        defaultServiceType={srDialogDefaultType}
        defaultDesiredDate={isReservation ? reservation?.checkOut : intervention?.startDate}
        onCreated={() => {
          showSnackbar('Demande de service créée avec succès');
          // Refetch service requests so they appear in the sidebar
          queryClient.invalidateQueries({ queryKey: ['planning', 'service-requests', currentReservationId] });
          // Also refresh interventions in case auto-assign created one
          queryClient.invalidateQueries({ queryKey: ['planning-page'] });
          onServiceRequestCreated?.();
        }}
      />

      {/* Unified Assign Dialog (intervention & service request) */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {assignMode === 'service_request'
              ? <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><PersonAdd size={20} strokeWidth={1.75} /></Box>
              : <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Groups size={20} strokeWidth={1.75} /></Box>}
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {assignMode === 'service_request' ? 'Assigner la demande' : 'Assigner intervention'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAssignDialogOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {assignMode === 'intervention' && assignTarget && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Intervention : <strong>{assignTarget.title}</strong>
            </Typography>
          )}
          {assignMode === 'service_request' && assignSrTargetId && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Demande de service #{assignSrTargetId}
              {assignSrDesiredDate && <> — Date souhaitée : <strong>{assignSrDesiredDate}</strong></>}
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
                <Box component="span" sx={{ display: 'inline-flex', color: assignAutoMode ? 'primary.main' : 'text.secondary' }}><AutoFixHigh size={18} strokeWidth={1.75} /></Box>
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
              icon={<AutoFixHigh size={18} strokeWidth={1.75} />}
              sx={{ fontSize: '0.75rem', mb: 1.5, '& .MuiAlert-message': { py: 0.25 } }}
            >
              <strong>{autoAssignSuggestion.name}</strong> — {autoAssignSuggestion.reason}
            </Alert>
          )}

          <TextField
            select
            label="Assigner à"
            value={assignValue}
            onChange={(e) => {
              setAssignValue(e.target.value);
              // If user manually changes, turn off auto mode
              if (assignAutoMode && autoAssignSuggestion && e.target.value !== autoAssignSuggestion.key) {
                setAssignAutoMode(false);
              }
            }}
            size="small"
            fullWidth
            disabled={assignAutoMode}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          >
            {/* Operational users section */}
            {(usersData as OperationalUser[] | undefined)?.length ? (
              <ListSubheader sx={{ fontSize: '0.6875rem', lineHeight: '28px', color: 'text.secondary', fontWeight: 700 }}>
                Intervenants
              </ListSubheader>
            ) : null}
            {assigneeOptions
              .filter((o) => o.type === 'user')
              .map((opt) => (
                <MenuItem key={assigneeKey(opt)} value={assigneeKey(opt)} sx={{ fontSize: '0.8125rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Person size={16} strokeWidth={1.75} /></Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.3 }}>
                        {opt.label}
                      </Typography>
                      {opt.sublabel && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                          {opt.sublabel}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            {/* Teams section */}
            {(teamsData as PortfolioTeam[] | undefined)?.length ? (
              <ListSubheader sx={{ fontSize: '0.6875rem', lineHeight: '28px', color: 'text.secondary', fontWeight: 700 }}>
                Équipes
              </ListSubheader>
            ) : null}
            {assigneeOptions
              .filter((o) => o.type === 'team')
              .map((opt) => (
                <MenuItem key={assigneeKey(opt)} value={assigneeKey(opt)} sx={{ fontSize: '0.8125rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Groups size={16} strokeWidth={1.75} /></Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.3 }}>
                        {opt.label}
                      </Typography>
                      {opt.sublabel && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                          {opt.sublabel}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            {assigneeOptions.length === 0 && (
              <MenuItem disabled sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                Aucun intervenant ou équipe disponible
              </MenuItem>
            )}
          </TextField>

          {/* ── Team member availability panel ────────────────────────── */}
          {assignValue.startsWith('team-') && (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  mb: 0.75,
                  display: 'block',
                }}
              >
                Membres de l'équipe
              </Typography>

              {teamMembersLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Vérification de la disponibilité...
                  </Typography>
                </Box>
              )}

              {!teamMembersLoading && teamAvailabilityError && (
                <Alert severity="error" sx={{ fontSize: '0.7rem', py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                  {teamAvailabilityError}
                </Alert>
              )}

              {!teamMembersLoading && !teamAvailabilityError && teamMembers.length === 0 && teamAvailabilityInfo && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                  Aucun membre dans cette équipe
                </Typography>
              )}

              {!teamMembersLoading && teamMembers.length > 0 && (
                <>
                  {teamAvailabilityInfo && (
                    <Alert
                      severity={teamAvailabilityInfo.allAvailable ? 'success' : 'warning'}
                      sx={{ fontSize: '0.7rem', mb: 1, py: 0, '& .MuiAlert-message': { py: 0.5 } }}
                    >
                      {teamAvailabilityInfo.allAvailable
                        ? 'Tous les membres sont disponibles'
                        : 'Certains membres ont des interventions sur ce créneau'}
                    </Alert>
                  )}
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      overflow: 'hidden',
                    }}
                  >
                    {teamMembers.map((member, idx) => (
                      <Box
                        key={member.userId}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.5,
                          py: 0.75,
                          borderBottom: idx < teamMembers.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                          backgroundColor: member.available ? 'transparent' : 'action.hover',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box component="span" sx={{ display: 'inline-flex', color: member.available ? 'success.main' : 'text.disabled' }}><Person size={15} strokeWidth={1.75} /></Box>
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: '0.8rem',
                                lineHeight: 1.3,
                                fontWeight: 500,
                                color: member.available ? 'text.primary' : 'text.secondary',
                              }}
                            >
                              {member.firstName} {member.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                              {member.role}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          size="small"
                          label={
                            member.available
                              ? 'Disponible'
                              : `${member.conflictCount} intervention${member.conflictCount > 1 ? 's' : ''}`
                          }
                          sx={{
                            fontSize: '0.625rem',
                            height: 20,
                            fontWeight: 600,
                            backgroundColor: member.available ? 'success.50' : 'warning.50',
                            color: member.available ? 'success.dark' : 'warning.dark',
                            border: '1px solid',
                            borderColor: member.available ? 'success.200' : 'warning.200',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}

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
            startIcon={assignLoading ? <CircularProgress size={14} /> : <Check size={16} strokeWidth={1.75} />}
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
            <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}><PriorityHigh size={20} strokeWidth={1.75} /></Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Definir la priorite
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPriorityDialogOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
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
            startIcon={priorityLoading ? <CircularProgress size={14} /> : <Check size={16} strokeWidth={1.75} />}
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
            <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><CheckCircleOutline size={20} strokeWidth={1.75} /></Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Checklist operationnelle
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setChecklistOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
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
            startIcon={checklistSaving ? <CircularProgress size={14} /> : <Check size={16} strokeWidth={1.75} />}
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
            <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><NotificationsActive size={20} strokeWidth={1.75} /></Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Ajouter un rappel
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAlertDialogOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
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
            startIcon={alertSaving ? <CircularProgress size={14} /> : <NotificationsActive size={16} strokeWidth={1.75} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Ajouter rappel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      {/* Delete service request confirmation dialog */}
      <Dialog
        open={deleteSrDialogOpen}
        onClose={() => { setDeleteSrDialogOpen(false); setDeleteSrTarget(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>Supprimer la demande</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Êtes-vous sûr de vouloir supprimer la demande « {deleteSrTarget?.title} » ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => { setDeleteSrDialogOpen(false); setDeleteSrTarget(null); }}
            disabled={deleteSrLoading}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteSr}
            disabled={deleteSrLoading}
            startIcon={deleteSrLoading ? <CircularProgress size={14} /> : <DeleteOutline size={16} strokeWidth={1.75} />}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

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
