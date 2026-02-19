import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi, interventionsApi } from '../../services/api';
import type { Team, Intervention } from '../../services/api';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Query keys (exported for cross-module invalidation) ──────────────────────

export const teamsKeys = {
  all: ['teams'] as const,
  lists: () => [...teamsKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...teamsKeys.lists(), filters] as const,
  details: () => [...teamsKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...teamsKeys.details(), String(id)] as const,
  workload: (teamName: string) => [...teamsKeys.all, 'workload', teamName] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTeamsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // ─── UI state (non-server) ──────────────────────────────────────────────────
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 9;

  // ─── Permissions (useEffect — hasPermissionAsync depends on auth loading) ───

  const [canCreateTeams, setCanCreateTeams] = useState(false);
  const [canEditTeams, setCanEditTeams] = useState(false);
  const [canDeleteTeams, setCanDeleteTeams] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    const checkAllPermissions = async () => {
      const [canCreate, canEdit, canDelete] = await Promise.all([
        hasPermissionAsync('teams:create'),
        hasPermissionAsync('teams:edit'),
        hasPermissionAsync('teams:delete'),
      ]);
      setCanCreateTeams(canCreate);
      setCanEditTeams(canEdit);
      setCanDeleteTeams(canDelete);
      setPermissionsLoading(false);
    };
    checkAllPermissions();
  }, [hasPermissionAsync]);

  // ─── Teams list query ─────────────────────────────────────────────────────

  const teamsQuery = useQuery({
    queryKey: teamsKeys.lists(),
    queryFn: async () => {
      const data = await teamsApi.getAll();
      return extractApiList<Team>(data);
    },
    staleTime: 30_000,
  });

  const teams = teamsQuery.data ?? [];
  const loading = teamsQuery.isLoading;
  const error = teamsQuery.isError
    ? ((teamsQuery.error as { status?: number })?.status === 401
        ? t('teams.errors.authError')
        : (teamsQuery.error as { status?: number })?.status === 403
          ? t('teams.errors.forbiddenError')
          : t('teams.errors.connectionError'))
    : null;

  // ─── Workload data query ──────────────────────────────────────────────────

  const workloadQuery = useQuery({
    queryKey: ['teams-workload-counts'],
    queryFn: async () => {
      const data = await interventionsApi.getAll();
      const list = extractApiList<Intervention>(data);
      const counts: Record<string, number> = {};
      list.forEach((intervention) => {
        if (
          intervention.assignedToType === 'team' &&
          intervention.assignedToName &&
          (intervention.status === 'IN_PROGRESS' || intervention.status === 'PENDING' || intervention.status === 'AWAITING_VALIDATION')
        ) {
          counts[intervention.assignedToName] = (counts[intervention.assignedToName] || 0) + 1;
        }
      });
      return counts;
    },
    staleTime: 30_000,
  });

  const teamWorkloadCounts = workloadQuery.data ?? {};

  // ─── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.all });
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>, team: Team) => {
      setAnchorEl(event.currentTarget);
      setSelectedTeam(team);
    },
    [],
  );

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedTeam(null);
  }, []);

  const handleViewDetails = useCallback(() => {
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}`);
    }
    handleMenuClose();
  }, [selectedTeam, navigate, handleMenuClose]);

  const handleEdit = useCallback(() => {
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}/edit`);
    }
    handleMenuClose();
  }, [selectedTeam, navigate, handleMenuClose]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
    // Close menu but keep selectedTeam for dialog
    setAnchorEl(null);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedTeam(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!selectedTeam) return;
    deleteMutation.mutate(selectedTeam.id, {
      onSuccess: () => {
        handleCloseDeleteDialog();
      },
    });
  }, [selectedTeam, deleteMutation, handleCloseDeleteDialog]);

  // ─── Computed values ──────────────────────────────────────────────────────

  const filteredTeams = useMemo(() => {
    if (!Array.isArray(teams) || teams.length === 0) return [];

    return teams.filter((team) => {
      if (!team || !team.id) return false;

      // Type filter
      if (selectedType !== 'all' && team.interventionType !== selectedType) return false;

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = team.name?.toLowerCase().includes(term);
        const matchDescription = team.description?.toLowerCase().includes(term);
        if (!matchName && !matchDescription) return false;
      }

      return true;
    });
  }, [teams, selectedType, searchTerm]);

  // Reset page when filters change
  const setSearchTermAndReset = useCallback((val: string) => { setSearchTerm(val); setPage(0); }, []);
  const setSelectedTypeAndReset = useCallback((val: string) => { setSelectedType(val); setPage(0); }, []);

  const paginatedTeams = useMemo(
    () => filteredTeams.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE),
    [filteredTeams, page, ITEMS_PER_PAGE],
  );

  const loadTeams = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
  }, [queryClient]);

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    // State
    teams,
    loading,
    error,
    selectedTeam,
    anchorEl,
    searchTerm,
    selectedType,
    page,
    ITEMS_PER_PAGE,
    deleteDialogOpen,
    teamWorkloadCounts,
    canCreateTeams,
    canEditTeams,
    canDeleteTeams,
    permissionsLoading,

    // Setters
    setSearchTerm: setSearchTermAndReset,
    setSelectedType: setSelectedTypeAndReset,
    setPage,

    // Handlers
    loadTeams,
    handleMenuOpen,
    handleMenuClose,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog,
    confirmDelete,

    // Computed
    filteredTeams,
    paginatedTeams,

    // Pass-through
    navigate,
    t,
  };
}
