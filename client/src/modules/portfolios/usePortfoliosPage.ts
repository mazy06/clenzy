import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { managersApi, portfoliosKeys, propertyTeamsApi, propertyTeamsKeys } from '../../services/api';
import type { ManagerAssociations, PropertyTeamMapping } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export interface PortfolioClient {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phoneNumber?: string;
  associatedAt: string;
}

export interface PortfolioProperty {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  createdAt: string;
  ownerId: number;
}

export interface PortfolioTeam {
  id: number;
  name: string;
  memberCount: number;
  description?: string;
  assignedAt: string;
}

export interface PortfolioUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  assignedAt: string;
}

export interface Manager {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ConfirmationModalState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  severity?: 'warning' | 'error' | 'info';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePortfoliosPage() {
  const { user, hasPermissionAsync } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { notify } = useNotification();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [tabValue, setTabValue] = useState(0);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [editingClient, setEditingClient] = useState<PortfolioClient | null>(null);

  // ── Confirmation modal ───────────────────────────────────────────────────
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ── Permissions (useEffect + hasPermissionAsync — NOT useQuery) ──────────
  const [canView, setCanView] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      const [view] = await Promise.all([
        hasPermissionAsync('portfolios:view'),
      ]);
      setCanView(view);
      setPermissionsLoading(false);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ── Associations query (main data) ───────────────────────────────────────
  const associationsQuery = useQuery({
    queryKey: portfoliosKeys.associations(user?.id ?? ''),
    queryFn: () => managersApi.getAssociations(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const associations = associationsQuery.data;
  const clients = useMemo(() => (associations?.clients ?? []) as PortfolioClient[], [associations]);
  const properties = useMemo(() => (associations?.properties ?? []) as PortfolioProperty[], [associations]);
  const teams = useMemo(() => (associations?.teams ?? []) as PortfolioTeam[], [associations]);
  const users = useMemo(() => (associations?.users ?? []) as PortfolioUser[], [associations]);

  const loading = associationsQuery.isLoading || permissionsLoading;
  const error = associationsQuery.isError
    ? ((associationsQuery.error as { status?: number })?.status === 401
        ? t('portfolios.errors.authError')
        : (associationsQuery.error as { status?: number })?.status === 403
          ? t('portfolios.errors.forbiddenError')
          : t('portfolios.errors.connectionError'))
    : null;

  // ── Managers query (for reassignment dialog) ────────────────────────────
  const managersQuery = useQuery({
    queryKey: portfoliosKeys.managers(),
    queryFn: () => managersApi.getAll(),
    staleTime: 60_000,
  });

  const managers = useMemo(
    () => (managersQuery.data ?? []) as Manager[],
    [managersQuery.data],
  );

  // ── Property-Team mappings query ──────────────────────────────────────
  const propertyIds = useMemo(
    () => properties.map(p => p.id),
    [properties],
  );

  const propertyTeamsQuery = useQuery({
    queryKey: propertyTeamsKeys.byProperties(propertyIds),
    queryFn: () => propertyTeamsApi.getByProperties(propertyIds),
    enabled: propertyIds.length > 0,
    staleTime: 30_000,
  });

  const propertyTeamMap = useMemo(() => {
    const map = new Map<number, PropertyTeamMapping>();
    if (propertyTeamsQuery.data) {
      for (const mapping of propertyTeamsQuery.data) {
        map.set(mapping.propertyId, mapping);
      }
    }
    return map;
  }, [propertyTeamsQuery.data]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const reassignClientMutation = useMutation({
    mutationFn: ({ clientId, newManagerId }: { clientId: number; newManagerId: number }) =>
      managersApi.reassignClient(clientId, { newManagerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfoliosKeys.all });
      setEditingClient(null);
      notify.success(t('portfolios.notifications.clientReassigned'));
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.reassignConnectionError'));
    },
  });

  const unassignClientMutation = useMutation({
    mutationFn: (clientId: number) => managersApi.removeClient(user!.id, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfoliosKeys.all });
      notify.success(t('portfolios.notifications.clientUnassigned'));
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.connectionError'));
    },
  });

  const unassignTeamMutation = useMutation({
    mutationFn: (teamId: number) => managersApi.removeTeam(user!.id, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfoliosKeys.all });
      notify.success(t('portfolios.notifications.teamUnassigned'));
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.connectionError'));
    },
  });

  const unassignUserMutation = useMutation({
    mutationFn: (userId: number) => managersApi.removeUser(user!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfoliosKeys.all });
      notify.success(t('portfolios.notifications.userUnassigned'));
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.connectionError'));
    },
  });

  const unassignPropertyMutation = useMutation({
    mutationFn: (propertyId: number) => managersApi.removeProperty(user!.id, propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfoliosKeys.all });
      notify.success(t('portfolios.notifications.propertyUnassigned'));
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.connectionError'));
    },
  });

  const assignTeamToPropertyMutation = useMutation({
    mutationFn: ({ propertyId, teamId }: { propertyId: number; teamId: number }) =>
      propertyTeamsApi.assign(propertyId, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyTeamsKeys.all });
      notify.success(t('portfolios.notifications.teamAssignedToProperty'));
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.connectionError'));
    },
  });

  const removeTeamFromPropertyMutation = useMutation({
    mutationFn: (propertyId: number) => propertyTeamsApi.remove(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyTeamsKeys.all });
      notify.success(t('portfolios.notifications.teamRemovedFromProperty'));
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.connectionError'));
    },
  });

  // ── Tab handler ──────────────────────────────────────────────────────────
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  }, []);

  // ── Client expansion toggle ──────────────────────────────────────────────
  const toggleClientExpansion = useCallback((clientId: number) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  }, []);

  // ── Navigation handlers ──────────────────────────────────────────────────
  const handleClientAssignment = useCallback(() => {
    navigate('/portfolios/client-assignment');
  }, [navigate]);

  const handleTeamAssignment = useCallback(() => {
    navigate('/portfolios/team-assignment');
  }, [navigate]);

  // ── Reassignment handler ─────────────────────────────────────────────────
  const handleReassignClient = useCallback(
    (clientId: number, newManagerId: number, _notes: string) => {
      reassignClientMutation.mutate({ clientId, newManagerId });
    },
    [reassignClientMutation],
  );

  // ── Unassign handlers (with confirmation modal) ──────────────────────────
  const handleUnassignClient = useCallback(
    (clientId: number) => {
      if (!user?.id) return;
      setConfirmationModal({
        open: true,
        title: t('portfolios.confirmations.unassignClientTitle'),
        message: t('portfolios.confirmations.unassignClientMessage'),
        severity: 'warning',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, open: false }));
          unassignClientMutation.mutate(clientId);
        },
      });
    },
    [user?.id, t, unassignClientMutation],
  );

  const handleUnassignTeam = useCallback(
    (teamId: number) => {
      if (!user?.id) return;
      setConfirmationModal({
        open: true,
        title: t('portfolios.confirmations.unassignTeamTitle'),
        message: t('portfolios.confirmations.unassignTeamMessage'),
        severity: 'warning',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, open: false }));
          unassignTeamMutation.mutate(teamId);
        },
      });
    },
    [user?.id, t, unassignTeamMutation],
  );

  const handleUnassignUser = useCallback(
    (userId: number) => {
      if (!user?.id) return;
      setConfirmationModal({
        open: true,
        title: t('portfolios.confirmations.unassignUserTitle'),
        message: t('portfolios.confirmations.unassignUserMessage'),
        severity: 'warning',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, open: false }));
          unassignUserMutation.mutate(userId);
        },
      });
    },
    [user?.id, t, unassignUserMutation],
  );

  const handleUnassignProperty = useCallback(
    (propertyId: number) => {
      if (!user?.id) return;
      setConfirmationModal({
        open: true,
        title: t('portfolios.confirmations.unassignPropertyTitle'),
        message: t('portfolios.confirmations.unassignPropertyMessage'),
        severity: 'warning',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, open: false }));
          unassignPropertyMutation.mutate(propertyId);
        },
      });
    },
    [user?.id, t, unassignPropertyMutation],
  );

  // ── Property-team handlers ─────────────────────────────────────────────
  const handleAssignTeamToProperty = useCallback(
    (propertyId: number, teamId: number) => {
      assignTeamToPropertyMutation.mutate({ propertyId, teamId });
    },
    [assignTeamToPropertyMutation],
  );

  const handleRemoveTeamFromProperty = useCallback(
    (propertyId: number) => {
      setConfirmationModal({
        open: true,
        title: t('portfolios.confirmations.removeTeamFromPropertyTitle'),
        message: t('portfolios.confirmations.removeTeamFromPropertyMessage'),
        severity: 'warning',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, open: false }));
          removeTeamFromPropertyMutation.mutate(propertyId);
        },
      });
    },
    [t, removeTeamFromPropertyMutation],
  );

  // ── Close confirmation modal ─────────────────────────────────────────────
  const closeConfirmationModal = useCallback(() => {
    setConfirmationModal(prev => ({ ...prev, open: false }));
  }, []);

  // ── Utility functions ────────────────────────────────────────────────────
  const formatDate = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const getRoleColor = useCallback((role: string): ChipColor => {
    switch (role) {
      case 'HOST': return 'primary';
      case 'TECHNICIAN': return 'secondary';
      case 'HOUSEKEEPER': return 'success';
      case 'SUPERVISOR': return 'warning';
      default: return 'default';
    }
  }, []);

  const getRoleLabel = useCallback((role: string) => {
    switch (role) {
      case 'HOST': return t('portfolios.roles.owner');
      case 'TECHNICIAN': return t('portfolios.roles.technician');
      case 'HOUSEKEEPER': return t('portfolios.roles.housekeeper');
      case 'SUPERVISOR': return t('portfolios.roles.supervisor');
      default: return role;
    }
  }, [t]);

  // ── Return ───────────────────────────────────────────────────────────────
  return {
    // Permission
    canView,
    permissionsLoading,
    // Translation
    t,
    // Tab
    tabValue,
    handleTabChange,
    // Data
    clients,
    properties,
    teams,
    users,
    loading,
    error,
    managers,
    reassignLoading: reassignClientMutation.isPending,
    expandedClients,
    // Editing
    editingClient,
    setEditingClient,
    // Handlers
    handleClientAssignment,
    handleTeamAssignment,
    toggleClientExpansion,
    handleReassignClient,
    handleUnassignClient,
    handleUnassignTeam,
    handleUnassignUser,
    handleUnassignProperty,
    // Property-team
    propertyTeamMap,
    handleAssignTeamToProperty,
    handleRemoveTeamFromProperty,
    // Confirmation modal
    confirmationModal,
    closeConfirmationModal,
    // Utilities
    formatDate,
    getRoleColor,
    getRoleLabel,
    // Pass-through
    navigate,
  };
}
