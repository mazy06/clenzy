import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Badge } from '../../../components/ui';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Typography, Button, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton, Snackbar, List, ListItem, ListItemText, Checkbox, Switch, FormControlLabel, Tooltip, LinearProgress, ListSubheader } from '@mui/material';
import {
  Handyman,
  BroomFill,
  WrenchFill,
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
  ChevronRight,
  Search as InspectIcon,
  MeetingRoom,
  CameraAlt,
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
import { INTERVENTION_TYPE_TOKEN_COLORS } from '../constants';
import type { PlanningIntervention } from '../../../services/api';
import { managersApi } from '../../../services/api/portfoliosApi';
import type { PortfolioTeam, OperationalUser } from '../../../services/api';
import { interventionsApi } from '../../../services/api/interventionsApi';
import { Money } from '../../../components/Money';
import type { TeamMemberAvailability } from '../../../services/api/interventionsApi';
import { serviceRequestsApi } from '../../../services/api/serviceRequestsApi';
import type { ServiceRequest } from '../../../services/api/serviceRequestsApi';
import { useWorkflowSettings } from '../../../hooks/useWorkflowSettings';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import CreateServiceRequestDialog from './CreateServiceRequestDialog';
import MessagingAutomationStatus from './MessagingAutomationStatus';
import { STATUS_TONES, toneTokensSx, type ToneTokens } from '../../../components/StatusChip';

// ── Assignee option (user or team) ──────────────────────────────────────────
interface AssigneeOption {
  id: number;
  type: 'user' | 'team';
  label: string;        // Display name
  sublabel?: string;    // Role or intervention type
}

type SoftTokens = ToneTokens;

const OK_TOKENS: SoftTokens = STATUS_TONES.ok;
const WARN_TOKENS: SoftTokens = STATUS_TONES.warn;
const ERR_TOKENS: SoftTokens = STATUS_TONES.err;
const INFO_TOKENS: SoftTokens = STATUS_TONES.info;
const NEUTRAL_TOKENS: SoftTokens = STATUS_TONES.neutral;

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
};

/** ✕ de modale — pattern validé (34px r10 hairline, hover --err). */
const CLOSE_BTN_SX = {
  width: 34,
  height: 34,
  borderRadius: '10px',
  border: '1px solid var(--line-2)',
  backgroundColor: 'var(--card)',
  color: 'var(--muted)',
  transition: 'color .14s, border-color .14s',
  '&:hover': { color: 'var(--err)', borderColor: 'var(--err)', backgroundColor: 'var(--card)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
};

/** Chip statut pilule — même pattern que PanelReservationInfo (texte couleur + fond soft). */

const PRIORITY_OPTIONS: { value: 'normale' | 'haute' | 'urgente'; label: string; tokens: SoftTokens }[] = [
  { value: 'normale', label: 'Normale', tokens: NEUTRAL_TOKENS },
  { value: 'haute', label: 'Haute', tokens: WARN_TOKENS },
  { value: 'urgente', label: 'Urgente', tokens: ERR_TOKENS },
];

const DEFAULT_CHECKLIST = [
  'Verifier les equipements',
  'Nettoyage des surfaces',
  'Inspection des sanitaires',
  'Verification du linge',
  'Photo de controle',
];

// ── Service request status tokens (attente = warn, en cours/assignée = info,
//    succès = ok, échec = err, annulée = neutre) ──────────────────────────────
const SR_STATUS_CONFIG: Record<string, { label: string; tokens: SoftTokens }> = {
  PENDING: { label: "En attente d'assignation", tokens: WARN_TOKENS },
  ASSIGNED: { label: 'Assignée', tokens: INFO_TOKENS },
  AWAITING_PAYMENT: { label: 'En attente de paiement', tokens: WARN_TOKENS },
  IN_PROGRESS: { label: 'En cours', tokens: INFO_TOKENS },
  COMPLETED: { label: 'Terminée', tokens: OK_TOKENS },
  CANCELLED: { label: 'Annulée', tokens: NEUTRAL_TOKENS },
  REJECTED: { label: 'Rejetée', tokens: ERR_TOKENS },
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
const PAYMENT_STATUS_CONFIG: Record<string, { label: string; tokens: SoftTokens }> = {
  PAID: { label: 'Payé', tokens: OK_TOKENS },
  PENDING: { label: 'En attente', tokens: WARN_TOKENS },
  PROCESSING: { label: 'En cours', tokens: INFO_TOKENS },
  FAILED: { label: 'Échoué', tokens: ERR_TOKENS },
  REFUNDED: { label: 'Remboursé', tokens: ERR_TOKENS },
  CANCELLED: { label: 'Annulé', tokens: NEUTRAL_TOKENS },
};

// ── Intervention status labels ───────────────────────────────────────────────
const INTERVENTION_STATUS_CONFIG: Record<string, { label: string; tokens: SoftTokens }> = {
  scheduled: { label: 'Planifiée', tokens: INFO_TOKENS },
  in_progress: { label: 'En cours', tokens: INFO_TOKENS },
  completed: { label: 'Terminée', tokens: OK_TOKENS },
  cancelled: { label: 'Annulée', tokens: NEUTRAL_TOKENS },
  awaiting_validation: { label: 'Validation', tokens: WARN_TOKENS },
  awaiting_payment: { label: 'Attente paiement', tokens: WARN_TOKENS },
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

/** Helper to build a composite key for an assignee option */
const assigneeKey = (opt: AssigneeOption) => `${opt.type}-${opt.id}`;

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
      const list = result;
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
  const [editingSrId, setEditingSrId] = useState<number | null>(null);

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
    setEditingSrId(null);
    setSrDialogDefaultType('CLEANING');
    setSrDialogOpen(true);
  };

  // 2. Demande de maintenance → open CreateServiceRequestDialog with type='PREVENTIVE_MAINTENANCE'
  const handleMaintenanceRequestClick = () => {
    setEditingSrId(null);
    setSrDialogDefaultType('PREVENTIVE_MAINTENANCE');
    setSrDialogOpen(true);
  };

  // 3. Nouvelle demande de service → open CreateServiceRequestDialog with type='OTHER'
  const handleNewServiceRequestClick = () => {
    setEditingSrId(null);
    setSrDialogDefaultType('OTHER');
    setSrDialogOpen(true);
  };

  // 3-bis. Éditer une demande de service existante → rouvre le même modal pré-rempli
  const handleEditServiceRequest = (srId: number) => {
    setSrDialogDefaultType(undefined);
    setEditingSrId(srId);
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
      <div className="mt-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="inline-flex text-muted-foreground"><CalendarMonth size={18} strokeWidth={1.75} /></span>
          <p className="cn-text-body2 font-semibold flex-1 text-[0.8125rem]">
            Dates & Horaires
          </p>
          {!editing ? (
            <IconButton size="small" onClick={() => setEditing(true)} sx={{ p: 0.25 }}>
              <span className="inline-flex text-muted-foreground"><Edit size={14} strokeWidth={1.75} /></span>
            </IconButton>
          ) : (
            <div className="flex gap-0.5">
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                sx={{ p: 0.25, color: 'var(--ok)' }}
              >
                {saving ? <Spinner className="size-3.5" /> : <Check size={16} strokeWidth={1.75} />}
              </IconButton>
              <IconButton size="small" onClick={handleCancel} sx={{ p: 0.25, color: 'var(--err)' }}>
                <Close size={16} strokeWidth={1.75} />
              </IconButton>
            </div>
          )}
        </div>

        {!editing ? (
          /* Display mode */
          <div className="flex justify-between items-center">
            <div>
              <span className="cn-text-caption text-muted-foreground">Debut</span>
              <p className="cn-text-body2 font-semibold text-[0.8125rem]">
                {intv.startDate}
              </p>
              {intv.startTime && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="inline-flex text-muted-foreground"><Schedule size={12} strokeWidth={1.75} /></span>
                  <span className="cn-text-caption font-medium">
                    {intv.startTime}
                  </span>
                </div>
              )}
            </div>
            <span className="inline-flex text-muted-foreground opacity-60"><SwapHoriz  /></span>
            <div className="text-end">
              <span className="cn-text-caption text-muted-foreground">Fin</span>
              <p className="cn-text-body2 font-semibold text-[0.8125rem]">
                {intv.endDate}
              </p>
              {intv.endTime && (
                <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                  <span className="inline-flex text-muted-foreground"><Schedule size={12} strokeWidth={1.75} /></span>
                  <span className="cn-text-caption font-medium">
                    {intv.endTime}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Edit mode */
          <div className="flex flex-col gap-2">
            <div>
              <span className="cn-text-caption text-muted-foreground mb-0.5 block">
                Debut
              </span>
              <div className="flex gap-1.5">
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
              </div>
            </div>

            <div>
              <span className="cn-text-caption text-muted-foreground mb-0.5 block">
                Fin
              </span>
              <div className="flex gap-1.5">
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
              </div>
            </div>

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
              <span className="cn-text-caption text-[0.625rem] text-[var(--warn)]">
                L'intervention sera deliee de sa reservation si les dates sont modifiees.
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Intervention info (if clicking on an intervention) */}
      {intervention && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="inline-flex" style={{ color: intervention.type === 'cleaning' ? INTERVENTION_TYPE_TOKEN_COLORS.cleaning : INTERVENTION_TYPE_TOKEN_COLORS.maintenance }}>
              {intervention.type === 'cleaning' ? (
                <BroomFill size={20} />
              ) : (
                <WrenchFill size={19} />
              )}
            </span>
            <h6 className="cn-text-subtitle2 font-bold">
              {intervention.title}
            </h6>
          </div>
          <div className="flex gap-1.5 mb-1.5 flex-wrap">
            {(() => {
              const t = INTERVENTION_STATUS_CONFIG[intervention.status]?.tokens
                || (intervention.status === 'cancelled' ? ERR_TOKENS : WARN_TOKENS);
              return (
                <StatusChip pill size="sm" tokens={{ color: t.color, bg: t.bg }} label={intervention.status} />
              );
            })()}
            <StatusChip pill size="sm" tokens={{ color: 'var(--muted)', bg: 'var(--hover)' }} label={intervention.assigneeName} />
            {intervention.estimatedDurationHours && (
              <StatusChip pill size="sm" tokens={{ color: INFO_TOKENS.color, bg: INFO_TOKENS.bg }} label={`${intervention.estimatedDurationHours}h`} className="tabular-nums" />
            )}
          </div>
          {intervention.notes && (
            <p className="cn-text-body2 text-muted-foreground text-[0.75rem] whitespace-pre-line">
              {intervention.notes}
            </p>
          )}
          {canEditIntervention && <EditableInterventionDatesSection />}
          <Divider sx={{ my: 1 }} />
        </div>
      )}

      {/* ── Reservation view: Full operations lifecycle ─────────────────────── */}
      {isReservation && (
        <>
          {/* Service request creation buttons */}
          <div>
            <span className="block text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)] mb-1.5">
              Demandes de service
            </span>
            <div className="flex flex-col gap-1">
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
            </div>
          </div>

          {/* Linked service requests with full lifecycle */}
          {(serviceRequests && serviceRequests.length > 0) && (
            <>
              <Divider />
              <div>
                <span className="block text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)] mb-1">
                  Demandes liees · {serviceRequests.length}
                </span>
                {serviceRequests.map((sr) => {
                  const statusCfg = SR_STATUS_CONFIG[sr.status] || { label: sr.status, tokens: NEUTRAL_TOKENS };
                  const typeLabel = SERVICE_TYPE_LABELS[sr.serviceType] || sr.serviceType;
                  const isCleaningSr = sr.serviceType.includes('CLEANING');
                  const srTypeColor = isCleaningSr ? INTERVENTION_TYPE_TOKEN_COLORS.cleaning : INTERVENTION_TYPE_TOKEN_COLORS.maintenance;
                  const isReadyForPayment = sr.status === 'AWAITING_PAYMENT';
                  const isPending = sr.status === 'PENDING';
                  const isValidating = validatingId === sr.id;
                  const assigneeName = sr.assignedToTeam?.name
                    || (sr.assignedToUser ? `${sr.assignedToUser.firstName} ${sr.assignedToUser.lastName}` : null)
                    || sr.assignedToName;
                  return (
                    <div
                      key={sr.id}
                      className="mb-[4.5px] p-[7.5px] rounded-[16px] border border-solid border-[var(--line)] transition-all duration-150 ease-[ease]"
                    >
                      {/* Header: icône type + titre + assigné en sous-ligne + lien */}
                      {/* La fleche est convertie en meme temps que ce parent : un
                          `opacity` reste en sx (Emotion, hors @layer) battrait la
                          regle de survol Tailwind, qui elle est dans @layer utilities. */}
                      <div
                        onClick={() => navigate(`/service-requests/${sr.id}`)}
                        className="flex items-start gap-[5.25px] cursor-pointer hover:[&_.sr-arrow]:opacity-100 hover:[&_.sr-arrow]:translate-x-[2px]"
                      >
                        <span className="inline-flex mt-0.5" style={{ color: srTypeColor }}>
                          {isCleaningSr ? <BroomFill size={14} /> : <WrenchFill size={13} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="cn-text-body1 text-[0.75rem] font-semibold text-[var(--ink)] leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap">
                            {sr.title}
                          </p>
                          {assigneeName && (
                            <div className="flex items-center gap-0.5 mt-0">
                              <span className="inline-flex text-[var(--muted)]">
                                <Groups size={11} strokeWidth={1.75} />
                              </span>
                              <p className="cn-text-body1 text-[0.625rem] font-medium text-[var(--muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                                {assigneeName}
                              </p>
                            </div>
                          )}
                        </div>
                        <span className="sr-arrow inline-flex mt-[2px] text-[var(--muted)] opacity-40 transition-all duration-150 ease-[ease]">
                          <OpenInNew size={14} strokeWidth={1.75} />
                        </span>
                      </div>
                      {/* Méta : type + montant + statut (icône↔libellé espacés) */}
                      <div className="flex items-center gap-0.5 mt-1.5 mb-0.5 flex-wrap">
                        <StatusChip tokens={{ color: srTypeColor, bg: `color-mix(in srgb, ${srTypeColor} 14%, transparent)` }} label={typeLabel} icon={isCleaningSr ? <BroomFill size={11} /> : <WrenchFill size={11} />} className="text-[0.5625rem] h-[21px]" />
                        {typeof sr.estimatedCost === 'number' && sr.estimatedCost > 0 && (
                          <Badge variant="secondary" className="text-[0.5625rem] h-[21px] font-bold bg-[var(--hover)] text-[var(--ink)] rounded-[6px] tabular-nums px-1">{<Money value={sr.estimatedCost} from="EUR" decimals={0} />}</Badge>
                        )}
                        <StatusChip tokens={{ color: statusCfg.tokens.color, bg: statusCfg.tokens.bg }} label={statusCfg.label} className="text-[0.5625rem] h-[21px] tracking-[0.01em]" />
                      </div>
                      {/* Actions selon le statut */}
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
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
                          <div className="flex items-center gap-0.5">
                            {sr.autoAssignStatus === 'searching' && (
                              <>
                                <Spinner className="size-2.5 text-[var(--muted)]" />
                                <span className="cn-text-caption text-[0.625rem] text-muted-foreground italic">
                                  Recherche en cours...
                                </span>
                              </>
                            )}
                            {sr.autoAssignStatus === 'exhausted' && (
                              <span className="cn-text-caption text-[0.625rem] text-[var(--warn)] italic">
                                Aucune equipe disponible — assignation manuelle requise
                              </span>
                            )}
                            {(!sr.autoAssignStatus || sr.autoAssignStatus === 'found') && (
                              <span className="cn-text-caption text-[0.625rem] text-muted-foreground italic">
                                En attente d&apos;assignation
                              </span>
                            )}
                          </div>
                        )}
                        {/* Admin indicator for auto-assign status */}
                        {isPending && !assigneeName && canEditIntervention && sr.autoAssignStatus === 'exhausted' && (
                          <Alert severity="warning" sx={{ py: 0, px: 0.5, fontSize: '0.6rem', '& .MuiAlert-icon': { fontSize: '0.75rem', py: 0, mr: 0.5 }, '& .MuiAlert-message': { py: 0.25 } }}>
                            Aucune equipe dispo — assignation manuelle requise
                          </Alert>
                        )}
                        {isPending && !assigneeName && canEditIntervention && sr.autoAssignStatus === 'searching' && (
                          <div className="flex items-center gap-0.5">
                            <Spinner className="size-2.5 text-[var(--muted)]" />
                            <span className="cn-text-caption text-[0.6rem] text-muted-foreground italic">
                              Recherche auto...
                            </span>
                          </div>
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
                        {/* Éditer la demande (admin/manager) — rouvre le modal pré-rempli */}
                        {canEditIntervention && sr.status !== 'COMPLETED' && sr.status !== 'PAID' && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Edit size={14} strokeWidth={1.75} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditServiceRequest(sr.id);
                            }}
                            sx={{
                              fontSize: '0.6875rem', textTransform: 'none',
                              py: 0.25, px: 1.5, borderRadius: 1,
                            }}
                          >
                            Éditer
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
                            sx={{ color: 'var(--err)', ml: 'auto', p: 0.5 }}
                          >
                            <DeleteOutline size={16} strokeWidth={1.75} />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* All interventions linked to this reservation (full lifecycle view) */}
          {linkedInterventions.length > 0 && (
            <>
              <Divider />
              <div>
                <span className="block text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)] mb-1">
                  Interventions · {linkedInterventions.length}
                </span>
                {linkedInterventions.map((li) => {
                  const isAssigned = !!li.assigneeName;
                  const cost = li.actualCost || li.estimatedCost || 0;
                  const isPaid = li.paymentStatus === 'PAID';
                  const noCost = cost <= 0;
                  const isOnPlanning = isAssigned && (isPaid || noCost);
                  const statusCfg = INTERVENTION_STATUS_CONFIG[li.status] || { label: li.status, tokens: NEUTRAL_TOKENS };
                  const payStatusCfg = li.paymentStatus
                    ? (PAYMENT_STATUS_CONFIG[li.paymentStatus] || { label: li.paymentStatus, tokens: NEUTRAL_TOKENS })
                    : null;

                  const steps = new Set((li.completedSteps || '').split(',').filter(Boolean));
                  const inspDone = steps.has('inspection');
                  const roomsDone = steps.has('rooms');
                  const photosDone = steps.has('after_photos');
                  const progress = (inspDone ? 33 : 0) + (roomsDone ? 33 : 0) + (photosDone ? 34 : 0);
                  const isInProgress = ['in_progress', 'awaiting_validation'].includes(li.status);

                  return (
                    <div
                      key={li.id}
                      className={cn(
                        'mb-[4.5px] p-[7.5px] rounded-[16px] border border-solid transition-all duration-150 ease-[ease]',
                        isOnPlanning
                          ? 'border-[color-mix(in_srgb,var(--ok)_22%,transparent)] bg-[color-mix(in_srgb,var(--ok)_6%,transparent)]'
                          : 'border-[var(--line)] bg-transparent',
                      )}
                    >
                      {/* Header: icône type + titre + assigné en sous-ligne + flèche */}
                      <div
                        onClick={() => onNavigate?.({ type: 'intervention-detail', interventionId: li.id })}
                        className={cn(
                          'flex items-start gap-[5.25px]',
                          'hover:[&_.drill-arrow]:opacity-100 hover:[&_.drill-arrow]:translate-x-[2px]',
                          onNavigate ? 'cursor-pointer' : 'cursor-default',
                        )}
                      >
                        <span className="inline-flex mt-0.5" style={{ color: li.type === 'cleaning' ? INTERVENTION_TYPE_TOKEN_COLORS.cleaning : INTERVENTION_TYPE_TOKEN_COLORS.maintenance }}>
                          {li.type === 'cleaning' ? <BroomFill size={15} /> : <WrenchFill size={14} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="cn-text-body1 text-[0.75rem] font-semibold text-[var(--ink)] leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap">
                            {li.title}
                          </p>
                          {/* Assigné : sous-ligne discrète (libère la place, plus de chip vert) */}
                          <div className="flex items-center gap-0.5 mt-0">
                            <span className={cn('inline-flex', isAssigned ? 'text-[var(--muted)]' : 'text-[var(--warn)]')}>
                              {isAssigned ? <Groups size={11} strokeWidth={1.75} /> : <HourglassEmpty size={11} strokeWidth={1.75} />}
                            </span>
                            <Typography sx={{ fontSize: '0.625rem', fontWeight: 500, color: isAssigned ? 'var(--muted)' : 'var(--warn)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isAssigned ? li.assigneeName : 'Non assigné'}
                            </Typography>
                          </div>
                        </div>
                        <span className="drill-arrow inline-flex mt-[2px] text-[var(--muted)] opacity-40 transition-all duration-150 ease-[ease]">
                          <ChevronRight size={16} strokeWidth={1.75} />
                        </span>
                      </div>

                      {/* Méta : statut + montant/paiement ; indicateur planning à droite */}
                      <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
                        <StatusChip tokens={{ color: statusCfg.tokens.color, bg: statusCfg.tokens.bg }} label={statusCfg.label} className="text-[0.5625rem] h-[21px] tracking-[0.01em]" />
                        {/* Montant + paiement (montant mis en avant) */}
                        {cost > 0 && payStatusCfg && (
                          <StatusChip tokens={{ color: payStatusCfg.tokens.color, bg: payStatusCfg.tokens.bg }} label={<span className="inline-flex items-center gap-0.5">
                                <span className="font-bold tabular-nums"><Money value={cost} from="EUR" decimals={0} /></span>
                                <span className="opacity-50">·</span>
                                <span>{payStatusCfg.label}</span>
                              </span>} icon={<Payment size={10} strokeWidth={1.75} />} className="text-[0.5625rem] h-[21px]" />
                        )}
                        {/* Visibilité planning : icône seule, poussée à droite */}
                        <Tooltip title={isOnPlanning ? 'Visible sur le planning' : 'Non visible sur le planning (attribution et paiement requis)'}>
                          <span className={cn('ms-auto inline-flex items-center', isOnPlanning ? 'text-[var(--ok)]' : 'text-[var(--faint)]')}>
                            {isOnPlanning ? <Visibility size={13} strokeWidth={1.75} /> : <VisibilityOff size={13} strokeWidth={1.75} />}
                          </span>
                        </Tooltip>
                      </div>

                      {/* Progress bar (if in progress) */}
                      {isInProgress && (
                        <div className="mb-0.5">
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                              height: 4, borderRadius: 2, backgroundColor: 'var(--hover)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 2,
                                backgroundColor: progress === 100 ? 'var(--ok)' : 'var(--accent)',
                              },
                            }}
                          />
                        </div>
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
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty state when no service requests and no interventions */}
          {(!serviceRequests || serviceRequests.length === 0) && linkedInterventions.length === 0 && (
            <Alert severity="info" sx={{ fontSize: '0.75rem', '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
              Aucune demande de service ou intervention pour cette reservation. Utilisez les boutons ci-dessus pour creer une demande.
            </Alert>
          )}

          {/* Messagerie automatique (maquette : section dédiée de l'onglet Opérations) */}
          <Divider />
          <MessagingAutomationStatus
            guestEmail={reservation?.guestEmail}
            source={reservation?.source}
          />
        </>
      )}

      {/* ── Intervention view: Actions (assign, priority, checklist, alerts) ── */}
      {!isReservation && intervention && (
        <>
          <Divider />

          {/* Assignment */}
          <div>
            <p className="cn-text-body2 font-bold text-[0.8125rem] mb-1.5">
              Assignation
            </p>
            <div className="flex flex-col gap-1">
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
            </div>
          </div>

          <Divider />

          {/* Checklist & alerts */}
          <div>
            <p className="cn-text-body2 font-bold text-[0.8125rem] mb-1.5">
              Suivi
            </p>
            <div className="flex flex-col gap-1">
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
            </div>
          </div>
        </>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Create Service Request Dialog */}
      <CreateServiceRequestDialog
        open={srDialogOpen}
        onClose={() => { setSrDialogOpen(false); setEditingSrId(null); }}
        propertyId={propertyId}
        propertyName={propertyName}
        reservationId={currentReservationId}
        defaultServiceType={srDialogDefaultType}
        defaultDesiredDate={isReservation ? reservation?.checkOut : intervention?.startDate}
        editingServiceRequestId={editingSrId}
        onCreated={() => {
          showSnackbar(editingSrId ? 'Demande de service enregistrée' : 'Demande de service créée avec succès');
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
          <div className="flex items-center gap-1.5">
            {assignMode === 'service_request'
              ? <span className="inline-flex text-[var(--accent)]"><PersonAdd size={20} strokeWidth={1.75} /></span>
              : <span className="inline-flex text-[var(--accent)]"><Groups size={20} strokeWidth={1.75} /></span>}
            <h6 className="cn-text-h6 font-bold text-[1rem]">
              {assignMode === 'service_request' ? 'Assigner la demande' : 'Assigner intervention'}
            </h6>
          </div>
          <IconButton size="small" onClick={() => setAssignDialogOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {assignMode === 'intervention' && assignTarget && (
            <span className="cn-text-caption text-muted-foreground text-[0.6875rem] mb-2 block">
              Intervention : <strong>{assignTarget.title}</strong>
            </span>
          )}
          {assignMode === 'service_request' && assignSrTargetId && (
            <span className="cn-text-caption text-muted-foreground text-[0.6875rem] mb-2 block">
              Demande de service #{assignSrTargetId}
              {assignSrDesiredDate && <> — Date souhaitée : <strong>{assignSrDesiredDate}</strong></>}
            </span>
          )}

          {/* Auto-assign toggle (only visible if feature enabled in settings) */}
          {autoAssignEnabled && (
            <div
              className={cn(
                'flex items-center justify-between p-[9px] mb-[9px] rounded-[12px] border border-solid transition-all duration-200 ease-[ease]',
                assignAutoMode ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-transparent',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('inline-flex', assignAutoMode ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}><AutoFixHigh size={18} strokeWidth={1.75} /></span>
                <div>
                  <p className="cn-text-body2 font-semibold text-[0.8125rem] leading-[1.2]">
                    Assignation automatique
                  </p>
                  <span className="cn-text-caption text-muted-foreground text-[0.625rem]">
                    Selectionne le membre le moins charge
                  </span>
                </div>
              </div>
              <Switch
                size="small"
                checked={assignAutoMode}
                onChange={(e) => handleAutoAssignToggle(e.target.checked)}
              />
            </div>
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
              .flatMap((opt) => (opt.type === 'user' ? [(
                <MenuItem key={assigneeKey(opt)} value={assigneeKey(opt)} sx={{ fontSize: '0.8125rem' }}>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="inline-flex text-muted-foreground"><Person size={16} strokeWidth={1.75} /></span>
                    <div className="flex-1">
                      <p className="cn-text-body2 text-[0.8125rem] leading-[1.3]">
                        {opt.label}
                      </p>
                      {opt.sublabel && (
                        <span className="cn-text-caption text-muted-foreground text-[0.625rem]">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                </MenuItem>
              )] : []))}
            {/* Teams section */}
            {(teamsData as PortfolioTeam[] | undefined)?.length ? (
              <ListSubheader sx={{ fontSize: '0.6875rem', lineHeight: '28px', color: 'text.secondary', fontWeight: 700 }}>
                Équipes
              </ListSubheader>
            ) : null}
            {assigneeOptions
              .flatMap((opt) => (opt.type === 'team' ? [(
                <MenuItem key={assigneeKey(opt)} value={assigneeKey(opt)} sx={{ fontSize: '0.8125rem' }}>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="inline-flex text-[var(--accent)]"><Groups size={16} strokeWidth={1.75} /></span>
                    <div className="flex-1">
                      <p className="cn-text-body2 text-[0.8125rem] leading-[1.3]">
                        {opt.label}
                      </p>
                      {opt.sublabel && (
                        <span className="cn-text-caption text-muted-foreground text-[0.625rem]">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                </MenuItem>
              )] : []))}
            {assigneeOptions.length === 0 && (
              <MenuItem disabled sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                Aucun intervenant ou équipe disponible
              </MenuItem>
            )}
          </TextField>

          {/* ── Team member availability panel ────────────────────────── */}
          {assignValue.startsWith('team-') && (
            <div className="mt-3">
              <span className="cn-text-caption font-bold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.04em] mb-1 block">
                Membres de l'équipe
              </span>

              {teamMembersLoading && (
                <div className="flex items-center gap-1.5 py-1.5">
                  <Spinner className="size-3.5" />
                  <span className="cn-text-caption text-muted-foreground text-[0.75rem]">
                    Vérification de la disponibilité...
                  </span>
                </div>
              )}

              {!teamMembersLoading && teamAvailabilityError && (
                <Alert severity="error" sx={{ fontSize: '0.7rem', py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                  {teamAvailabilityError}
                </Alert>
              )}

              {!teamMembersLoading && !teamAvailabilityError && teamMembers.length === 0 && teamAvailabilityInfo && (
                <span className="cn-text-caption text-muted-foreground text-[0.75rem] italic">
                  Aucun membre dans cette équipe
                </span>
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
                  <div className="border border-[var(--line)] rounded-[1.5px] overflow-hidden">
                    {teamMembers.map((member, idx) => (
                      <div
                        key={member.userId}
                        className={cn(
                          'flex items-center justify-between px-[9px] py-[4.5px]',
                          idx < teamMembers.length - 1 && 'border-b border-solid border-b-[var(--line)]',
                          member.available ? 'bg-transparent' : 'bg-[var(--hover)]',
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={cn('inline-flex', member.available ? 'text-[var(--ok)]' : 'text-[var(--faint)]')}><Person size={15} strokeWidth={1.75} /></span>
                          <div>
                            <p className={cn('cn-text-body2 text-[0.8rem] leading-[1.3] font-medium', member.available ? 'text-[var(--ink)]' : 'text-[var(--muted)]')}>
                              {member.firstName} {member.lastName}
                            </p>
                            <span className="cn-text-caption text-muted-foreground text-[0.6rem]">
                              {member.role}
                            </span>
                          </div>
                        </div>
                        <StatusChip
                          size="sm"
                          tokens={member.available ? OK_TOKENS : WARN_TOKENS}
                          label={
                            member.available
                              ? 'Disponible'
                              : `${member.conflictCount} intervention${member.conflictCount > 1 ? 's' : ''}`
                          }
                          className="h-5 border border-solid font-semibold"
                          sx={{
                            borderColor: `color-mix(in srgb, ${member.available ? OK_TOKENS.color : WARN_TOKENS.color} 35%, transparent)`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {assignError && (
            <UiAlert variant="destructive" className="text-[0.75rem] mt-2">
              <TriangleAlert />
              <AlertDescription>{assignError}</AlertDescription>
            </UiAlert>
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
            startIcon={assignLoading ? <Spinner className="size-3.5" /> : <Check size={16} strokeWidth={1.75} />}
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
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--warn)]"><PriorityHigh size={20} strokeWidth={1.75} /></span>
            <h6 className="cn-text-h6 font-bold text-[1rem]">
              Definir la priorite
            </h6>
          </div>
          <IconButton size="small" onClick={() => setPriorityDialogOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {priorityTarget && (
            <span className="cn-text-caption text-muted-foreground text-[0.6875rem] mb-3 block">
              Intervention : <strong>{priorityTarget.title}</strong>
            </span>
          )}
          <div className="flex flex-col gap-1.5 mt-1.5">
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
                  borderColor: opt.tokens.color,
                  color: opt.tokens.color,
                  backgroundColor: priorityValue === opt.value ? opt.tokens.bg : 'transparent',
                  '&:hover': {
                    backgroundColor: opt.tokens.bg,
                    borderColor: opt.tokens.color,
                  },
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {priorityError && (
            <UiAlert variant="destructive" className="text-[0.75rem] mt-2">
              <TriangleAlert />
              <AlertDescription>{priorityError}</AlertDescription>
            </UiAlert>
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
            startIcon={priorityLoading ? <Spinner className="size-3.5" /> : <Check size={16} strokeWidth={1.75} />}
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
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--ok)]"><CheckCircleOutline size={20} strokeWidth={1.75} /></span>
            <h6 className="cn-text-h6 font-bold text-[1rem]">
              Checklist operationnelle
            </h6>
          </div>
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
            startIcon={checklistSaving ? <Spinner className="size-3.5" /> : <Check size={16} strokeWidth={1.75} />}
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
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--info)]"><NotificationsActive size={20} strokeWidth={1.75} /></span>
            <h6 className="cn-text-h6 font-bold text-[1rem]">
              Ajouter un rappel
            </h6>
          </div>
          <IconButton size="small" onClick={() => setAlertDialogOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <div className="flex gap-2 mb-3">
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
          </div>
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
            startIcon={alertSaving ? <Spinner className="size-3.5" /> : <NotificationsActive size={16} strokeWidth={1.75} />}
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
          <p className="cn-text-body2">
            Êtes-vous sûr de vouloir supprimer la demande « {deleteSrTarget?.title} » ? Cette action est irréversible.
          </p>
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
            startIcon={deleteSrLoading ? <Spinner className="size-3.5" /> : <DeleteOutline size={16} strokeWidth={1.75} />}
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
    </div>
  );
};

export default PanelOperations;
