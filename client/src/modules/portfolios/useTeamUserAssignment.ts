import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { managersApi, portfoliosKeys } from '../../services/api';
import type { Manager, PortfolioTeam, OperationalUser } from '../../services/api';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTeamUserAssignment() {
  const { user, hasPermissionAsync } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { notify } = useNotification();

  // ── Stepper state ────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);
  const steps = useMemo(() => [
    t('portfolios.steps.selectManager'),
    t('portfolios.steps.chooseTeams'),
    t('portfolios.steps.chooseUsers'),
    t('portfolios.steps.confirmAssignments'),
  ], [t]);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedManager, setSelectedManager] = useState<string | number | ''>('');
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // ── Permissions (useEffect + hasPermissionAsync — NOT useQuery) ──────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const adminPerm = await hasPermissionAsync('portfolios:manage_all');
      const managerPerm = await hasPermissionAsync('portfolios:manage');
      setIsAdmin(adminPerm);
      setIsManager(managerPerm && !adminPerm);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // Auto-select manager for non-admin managers
  useEffect(() => {
    if (isManager && !isAdmin && user?.id) {
      setSelectedManager(user.id);
    }
  }, [isAdmin, isManager, user?.id]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const managersQuery = useQuery({
    queryKey: portfoliosKeys.managers(),
    queryFn: () => managersApi.getAll(),
    staleTime: 60_000,
  });

  const managers = useMemo(
    () => extractApiList<Manager>(managersQuery.data),
    [managersQuery.data],
  );

  const teamsQuery = useQuery({
    queryKey: portfoliosKeys.teams(),
    queryFn: () => managersApi.getTeams(),
    enabled: !!selectedManager,
    staleTime: 60_000,
  });

  const teams = useMemo(
    () => extractApiList<PortfolioTeam>(teamsQuery.data),
    [teamsQuery.data],
  );

  const usersQuery = useQuery({
    queryKey: portfoliosKeys.operationalUsers(),
    queryFn: () => managersApi.getOperationalUsers(),
    enabled: !!selectedManager,
    staleTime: 60_000,
  });

  const operationalUsers = useMemo(
    () => extractApiList<OperationalUser>(usersQuery.data),
    [usersQuery.data],
  );

  const filteredUsers = useMemo(() => {
    if (!userSearchTerm) return operationalUsers;
    const term = userSearchTerm.toLowerCase();
    return operationalUsers.filter(u =>
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term),
    );
  }, [operationalUsers, userSearchTerm]);

  const loading = teamsQuery.isFetching || usersQuery.isFetching;

  // ── Mutation ─────────────────────────────────────────────────────────────

  const assignMutation = useMutation({
    mutationFn: () =>
      managersApi.assignTeamsUsers(selectedManager as number, {
        managerId: selectedManager,
        teamIds: selectedTeams,
        userIds: selectedUsers,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: portfoliosKeys.all });
      notify.success(
        `${t('portfolios.errors.assignmentSuccess')} ${result.teamsAssigned ?? 0} ${t('teams.title')} et ${result.usersAssigned ?? 0} ${t('users.title')}.`,
      );
      setTimeout(() => {
        navigate('/portfolios');
      }, 1500);
    },
    onError: (err: any) => {
      notify.error(err?.message || t('portfolios.errors.assignmentError'));
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    setActiveStep(prev => prev + 1);
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep(prev => prev - 1);
  }, []);

  const handleTeamToggle = useCallback((teamId: number) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId],
    );
  }, []);

  const handleUserToggle = useCallback((userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedManager) {
      notify.warning(t('portfolios.fields.selectManager'));
      return;
    }
    if (selectedTeams.length === 0 && selectedUsers.length === 0) {
      notify.warning(t('portfolios.warnings.noTeamSelectedWarning'));
      return;
    }
    assignMutation.mutate();
  }, [selectedManager, selectedTeams, selectedUsers, assignMutation, notify, t]);

  const canGoNext = useMemo(() => {
    switch (activeStep) {
      case 0: return !!selectedManager;
      case 2: return selectedTeams.length > 0 || selectedUsers.length > 0;
      default: return true;
    }
  }, [activeStep, selectedManager, selectedTeams, selectedUsers]);

  const getRoleColor = useCallback((role: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (role) {
      case 'HOUSEKEEPER': return 'success';
      case 'TECHNICIAN': return 'warning';
      case 'SUPERVISOR': return 'info';
      default: return 'default';
    }
  }, []);

  const getRoleLabel = useCallback((role: string) => {
    switch (role) {
      case 'HOUSEKEEPER': return t('portfolios.roles.housekeeper');
      case 'TECHNICIAN': return t('portfolios.roles.technician');
      case 'SUPERVISOR': return t('portfolios.roles.supervisor');
      default: return role;
    }
  }, [t]);

  // ── Return ───────────────────────────────────────────────────────────────

  return {
    // Auth
    user,
    isAdmin,
    isManager,
    // Stepper
    activeStep,
    steps,
    handleNext,
    handleBack,
    canGoNext,
    // Data
    managers,
    teams,
    operationalUsers,
    filteredUsers,
    loading,
    // Selections
    selectedManager,
    setSelectedManager,
    selectedTeams,
    selectedUsers,
    userSearchTerm,
    setUserSearchTerm,
    // Handlers
    handleTeamToggle,
    handleUserToggle,
    handleSubmit,
    submitting: assignMutation.isPending,
    // Utility
    getRoleColor,
    getRoleLabel,
    // Pass-through
    t,
    navigate,
  };
}
