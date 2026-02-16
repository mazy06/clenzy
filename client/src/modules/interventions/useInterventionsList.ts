import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, teamsApi, usersApi } from '../../services/api';
import type { Team } from '../../services/api';
import type { User } from '../../services/api/usersApi';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import type { ExportColumn } from '../../utils/exportUtils';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';

export interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  requestorName: string;
  assignedToName: string;
  assignedToType: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  progressPercentage: number;
  createdAt: string;
}

export function useInterventionsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermissionAsync, isHost, isManager, isAdmin } = useAuth();
  const { t } = useTranslation();

  // ─── State ────────────────────────────────────────────────────────────────
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 6;

  // Assign dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignType, setAssignType] = useState<'user' | 'team'>('team');
  const [assignTargetId, setAssignTargetId] = useState<number | ''>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Permissions state
  const [canViewInterventions, setCanViewInterventions] = useState(false);
  const [canCreateInterventions, setCanCreateInterventions] = useState(false);
  const [canEditInterventions, setCanEditInterventions] = useState(false);
  const [canDeleteInterventions, setCanDeleteInterventions] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // ─── Effects ──────────────────────────────────────────────────────────────

  // Check all permissions at once
  useEffect(() => {
    const checkAllPermissions = async () => {
      const [canView, canCreate, canEdit, canDelete] = await Promise.all([
        hasPermissionAsync('interventions:view'),
        hasPermissionAsync('interventions:create'),
        hasPermissionAsync('interventions:edit'),
        hasPermissionAsync('interventions:delete'),
      ]);

      setCanViewInterventions(canView);
      setCanCreateInterventions(canCreate);
      setCanEditInterventions(canEdit);
      setCanDeleteInterventions(canDelete);
      setPermissionsLoading(false);
    };

    checkAllPermissions();
  }, [hasPermissionAsync]);

  // Load interventions function
  const loadInterventions = useCallback(async () => {
    if (!canViewInterventions) {
      setInterventions([]);
      setError("Vous n'avez pas les permissions nécessaires pour voir les interventions.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await interventionsApi.getAll();
      setInterventions(extractApiList(data));
    } catch (err: unknown) {
      setInterventions([]);
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 401) {
        setError("Erreur d'authentification. Veuillez vous reconnecter.");
      } else if (apiErr.status === 403) {
        setError("Accès interdit. Vous n'avez pas les permissions nécessaires pour voir les interventions.");
      } else if (apiErr.status !== 404) {
        setError(apiErr.message || 'Erreur lors du chargement des interventions');
      }
    } finally {
      setLoading(false);
    }
  }, [canViewInterventions]);

  // Auto-load interventions when permission is granted and on the right path
  useEffect(() => {
    if (canViewInterventions && location.pathname === '/interventions') {
      loadInterventions();
    }
  }, [canViewInterventions, location.pathname, loadInterventions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedType, selectedStatus, selectedPriority]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => {
      setAnchorEl(event.currentTarget);
      setSelectedIntervention(intervention);
    },
    [],
  );

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedIntervention(null);
  }, []);

  const handleViewDetails = useCallback(() => {
    if (selectedIntervention) {
      navigate(`/interventions/${selectedIntervention.id}`);
    }
    handleMenuClose();
  }, [selectedIntervention, navigate, handleMenuClose]);

  const handleEdit = useCallback(() => {
    if (selectedIntervention) {
      navigate(`/interventions/${selectedIntervention.id}/edit`);
    }
    handleMenuClose();
  }, [selectedIntervention, navigate, handleMenuClose]);

  const handleDelete = useCallback(async () => {
    if (!selectedIntervention) return;

    try {
      await interventionsApi.delete(selectedIntervention.id);
      loadInterventions();
    } catch (err) {
      // Silently fail
    }

    handleMenuClose();
  }, [selectedIntervention, loadInterventions, handleMenuClose]);

  // ─── Assign dialog handlers ───────────────────────────────────────────────

  const handleOpenAssignDialog = useCallback(async () => {
    setAssignDialogOpen(true);
    setAssignType('team');
    setAssignTargetId('');
    // Close the context menu but keep selectedIntervention
    setAnchorEl(null);

    // Load teams and users in parallel
    try {
      const [fetchedTeams, fetchedUsers] = await Promise.all([
        teamsApi.getAll(),
        usersApi.getAll(),
      ]);
      setTeams(Array.isArray(fetchedTeams) ? fetchedTeams : []);
      setAvailableUsers(Array.isArray(fetchedUsers) ? fetchedUsers : []);
    } catch {
      setTeams([]);
      setAvailableUsers([]);
    }
  }, []);

  const handleCloseAssignDialog = useCallback(() => {
    setAssignDialogOpen(false);
    setSelectedIntervention(null);
  }, []);

  const handleAssign = useCallback(async () => {
    if (!selectedIntervention || assignTargetId === '') return;

    setAssignLoading(true);
    try {
      if (assignType === 'team') {
        await interventionsApi.assign(selectedIntervention.id, undefined, assignTargetId as number);
      } else {
        await interventionsApi.assign(selectedIntervention.id, assignTargetId as number, undefined);
      }
      setAssignDialogOpen(false);
      setSelectedIntervention(null);
      loadInterventions();
    } catch (err) {
      // Silently fail — error will appear via API notification
    } finally {
      setAssignLoading(false);
    }
  }, [selectedIntervention, assignTargetId, assignType, loadInterventions]);

  // ─── Permission check helper ──────────────────────────────────────────────

  const canModifyIntervention = useCallback(
    (intervention: Intervention): boolean => {
      if (canEditInterventions) return true;

      if (!intervention || !intervention.assignedToType) {
        return false;
      }

      // Teams can modify assigned interventions
      if (intervention.assignedToType === 'team') {
        return true;
      }

      // Users can modify assigned interventions
      if (intervention.assignedToType === 'user') {
        return true;
      }

      return false;
    },
    [canEditInterventions],
  );

  // ─── Computed values ──────────────────────────────────────────────────────

  const filteredInterventions = useMemo(() => {
    if (!Array.isArray(interventions) || interventions.length === 0) {
      return [];
    }

    return interventions.filter((intervention) => {
      if (!intervention || typeof intervention !== 'object') {
        return false;
      }

      if (
        !intervention.id ||
        !intervention.title ||
        !intervention.description ||
        !intervention.type ||
        !intervention.status ||
        !intervention.priority
      ) {
        return false;
      }

      // Role-based filtering
      let roleFilter = true;
      if (canEditInterventions) {
        roleFilter = true;
      } else if (user?.roles?.includes('HOST')) {
        roleFilter = true;
      } else {
        if (intervention.assignedToType) {
          roleFilter = intervention.assignedToType === 'user' || intervention.assignedToType === 'team';
        } else {
          roleFilter = false;
        }
      }

      if (!roleFilter) return false;

      // Search filter
      if (
        searchTerm &&
        !intervention.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !intervention.description.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Type filter
      if (selectedType !== 'all' && intervention.type !== selectedType) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && intervention.status !== selectedStatus) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== 'all' && intervention.priority !== selectedPriority) {
        return false;
      }

      return true;
    });
  }, [interventions, searchTerm, selectedType, selectedStatus, selectedPriority, canEditInterventions, user]);

  const paginatedInterventions = useMemo(
    () => filteredInterventions.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE),
    [filteredInterventions, page, ITEMS_PER_PAGE],
  );

  const exportColumns: ExportColumn[] = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Titre' },
      { key: 'type', label: 'Type', formatter: (v: string) => getInterventionTypeLabel(v, t) },
      { key: 'status', label: 'Statut', formatter: (v: string) => getInterventionStatusLabel(v, t) },
      { key: 'priority', label: 'Priorité', formatter: (v: string) => getInterventionPriorityLabel(v, t) },
      { key: 'propertyName', label: 'Propriété' },
      { key: 'assignedToName', label: 'Assigné à' },
      {
        key: 'scheduledDate',
        label: 'Date planifiée',
        formatter: (v: string) => (v ? new Date(v).toLocaleDateString('fr-FR') : ''),
      },
      { key: 'estimatedDurationHours', label: 'Durée estimée (h)' },
      { key: 'progressPercentage', label: 'Progression (%)' },
    ],
    [t],
  );

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    // State
    interventions,
    loading,
    error,
    selectedIntervention,
    anchorEl,
    searchTerm,
    selectedType,
    selectedStatus,
    selectedPriority,
    page,
    ITEMS_PER_PAGE,
    assignDialogOpen,
    assignType,
    assignTargetId,
    teams,
    availableUsers,
    assignLoading,
    canViewInterventions,
    canCreateInterventions,
    canEditInterventions,
    canDeleteInterventions,
    permissionsLoading,

    // Setters
    setSearchTerm,
    setSelectedType,
    setSelectedStatus,
    setSelectedPriority,
    setPage,
    setAssignType,
    setAssignTargetId,

    // Handlers
    loadInterventions,
    handleMenuOpen,
    handleMenuClose,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleOpenAssignDialog,
    handleCloseAssignDialog,
    handleAssign,
    canModifyIntervention,

    // Computed
    filteredInterventions,
    paginatedInterventions,
    exportColumns,

    // Auth helpers (pass through for the component)
    isHost,
    isManager,
    isAdmin,
    navigate,
    t,
    user,
  };
}
