import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Query keys (exported for cross-module invalidation) ──────────────────────

export const interventionsKeys = {
  all: ['interventions'] as const,
  lists: () => [...interventionsKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...interventionsKeys.lists(), filters] as const,
  details: () => [...interventionsKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...interventionsKeys.details(), String(id)] as const,
  pendingValidation: () => [...interventionsKeys.all, 'pending-validation'] as const,
  pendingPayment: () => [...interventionsKeys.all, 'pending-payment'] as const,
};

// ─── Supporting data keys ─────────────────────────────────────────────────────

const assignDataKeys = {
  teams: ['assign-teams'] as const,
  users: ['assign-users'] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInterventionsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, hasPermissionAsync, isHost, isManager, isAdmin } = useAuth();
  const { t } = useTranslation();

  // ─── UI state (non-server) ──────────────────────────────────────────────────
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

  // ─── Permissions (useEffect — hasPermissionAsync depends on auth loading state) ─

  const [canViewInterventions, setCanViewInterventions] = useState(false);
  const [canCreateInterventions, setCanCreateInterventions] = useState(false);
  const [canEditInterventions, setCanEditInterventions] = useState(false);
  const [canDeleteInterventions, setCanDeleteInterventions] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

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

  // ─── Interventions list query ───────────────────────────────────────────────

  const interventionsQuery = useQuery({
    queryKey: interventionsKeys.lists(),
    queryFn: async () => {
      const data = await interventionsApi.getAll();
      return extractApiList<Intervention>(data);
    },
    enabled: canViewInterventions && location.pathname === '/interventions',
    staleTime: 30_000,
  });

  const interventions = interventionsQuery.data ?? [];
  const loading = interventionsQuery.isLoading;
  const error = interventionsQuery.isError
    ? ((interventionsQuery.error as { status?: number; message?: string })?.status === 401
        ? "Erreur d'authentification. Veuillez vous reconnecter."
        : (interventionsQuery.error as { status?: number; message?: string })?.status === 403
          ? "Accès interdit. Vous n'avez pas les permissions nécessaires pour voir les interventions."
          : (interventionsQuery.error as { message?: string })?.message || 'Erreur lors du chargement des interventions')
    : (!canViewInterventions && !permissionsLoading
        ? "Vous n'avez pas les permissions nécessaires pour voir les interventions."
        : null);

  // ─── Assign dialog data queries ─────────────────────────────────────────────

  const teamsQuery = useQuery({
    queryKey: assignDataKeys.teams,
    queryFn: async () => {
      const data = await teamsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: assignDialogOpen,
    staleTime: 60_000,
  });

  const usersQuery = useQuery({
    queryKey: assignDataKeys.users,
    queryFn: async () => {
      const data = await usersApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: assignDialogOpen,
    staleTime: 60_000,
  });

  const teams = teamsQuery.data ?? [];
  const availableUsers = usersQuery.data ?? [];

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) => interventionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionsKeys.all });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ interventionId, userId, teamId }: { interventionId: number; userId?: number; teamId?: number }) =>
      interventionsApi.assign(interventionId, userId, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionsKeys.all });
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const loadInterventions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: interventionsKeys.lists() });
  }, [queryClient]);

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

  const handleDelete = useCallback(() => {
    if (!selectedIntervention) return;
    deleteMutation.mutate(selectedIntervention.id);
    handleMenuClose();
  }, [selectedIntervention, deleteMutation, handleMenuClose]);

  // ─── Assign dialog handlers ─────────────────────────────────────────────────

  const handleOpenAssignDialog = useCallback(() => {
    setAssignDialogOpen(true);
    setAssignType('team');
    setAssignTargetId('');
    // Close the context menu but keep selectedIntervention
    setAnchorEl(null);
  }, []);

  const handleCloseAssignDialog = useCallback(() => {
    setAssignDialogOpen(false);
    setSelectedIntervention(null);
  }, []);

  const handleAssign = useCallback(() => {
    if (!selectedIntervention || assignTargetId === '') return;

    const payload = assignType === 'team'
      ? { interventionId: selectedIntervention.id, teamId: assignTargetId as number }
      : { interventionId: selectedIntervention.id, userId: assignTargetId as number };

    assignMutation.mutate(payload, {
      onSuccess: () => {
        setAssignDialogOpen(false);
        setSelectedIntervention(null);
      },
    });
  }, [selectedIntervention, assignTargetId, assignType, assignMutation]);

  // ─── Permission check helper ────────────────────────────────────────────────

  const canModifyIntervention = useCallback(
    (intervention: Intervention): boolean => {
      if (canEditInterventions) return true;
      if (!intervention || !intervention.assignedToType) return false;
      if (intervention.assignedToType === 'team') return true;
      if (intervention.assignedToType === 'user') return true;
      return false;
    },
    [canEditInterventions],
  );

  // ─── Computed values ────────────────────────────────────────────────────────

  const filteredInterventions = useMemo(() => {
    if (!Array.isArray(interventions) || interventions.length === 0) return [];

    return interventions.filter((intervention) => {
      if (!intervention || typeof intervention !== 'object') return false;
      if (!intervention.id || !intervention.title || !intervention.description || !intervention.type || !intervention.status || !intervention.priority) return false;

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
      if (searchTerm && !intervention.title.toLowerCase().includes(searchTerm.toLowerCase()) && !intervention.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      // Type filter
      if (selectedType !== 'all' && intervention.type !== selectedType) return false;

      // Status filter
      if (selectedStatus !== 'all' && intervention.status !== selectedStatus) return false;

      // Priority filter
      if (selectedPriority !== 'all' && intervention.priority !== selectedPriority) return false;

      return true;
    });
  }, [interventions, searchTerm, selectedType, selectedStatus, selectedPriority, canEditInterventions, user]);

  // Reset page when filters change
  const setSearchTermAndReset = useCallback((val: string) => { setSearchTerm(val); setPage(0); }, []);
  const setSelectedTypeAndReset = useCallback((val: string) => { setSelectedType(val); setPage(0); }, []);
  const setSelectedStatusAndReset = useCallback((val: string) => { setSelectedStatus(val); setPage(0); }, []);
  const setSelectedPriorityAndReset = useCallback((val: string) => { setSelectedPriority(val); setPage(0); }, []);

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

  // ─── Return ─────────────────────────────────────────────────────────────────

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
    assignLoading: assignMutation.isPending,
    canViewInterventions,
    canCreateInterventions,
    canEditInterventions,
    canDeleteInterventions,
    permissionsLoading,

    // Setters
    setSearchTerm: setSearchTermAndReset,
    setSelectedType: setSelectedTypeAndReset,
    setSelectedStatus: setSelectedStatusAndReset,
    setSelectedPriority: setSelectedPriorityAndReset,
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
