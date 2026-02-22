import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { managersApi, portfoliosKeys } from '../../services/api';
import type { Manager, HostClient, AssignmentProperty } from '../../services/api';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useClientPropertyAssignment() {
  const { user, hasPermissionAsync } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { notify } = useNotification();

  // ── Stepper state ────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);
  const steps = useMemo(() => [
    t('portfolios.steps.selectManager'),
    t('portfolios.steps.chooseClients'),
    t('portfolios.steps.chooseProperties'),
    t('portfolios.steps.confirmAssignments'),
  ], [t]);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedManager, setSelectedManager] = useState<string | number | ''>('');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);

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

  const hostsQuery = useQuery({
    queryKey: portfoliosKeys.hosts(),
    queryFn: () => managersApi.getHosts(),
    enabled: !!selectedManager,
    staleTime: 60_000,
  });

  const hostUsers = useMemo(
    () => extractApiList<HostClient>(hostsQuery.data),
    [hostsQuery.data],
  );

  // Properties by selected clients
  const propertiesQuery = useQuery({
    queryKey: portfoliosKeys.propertiesByClients(selectedClients),
    queryFn: () => managersApi.getPropertiesByClients(selectedClients),
    enabled: selectedClients.length > 0,
    staleTime: 30_000,
  });

  const properties = useMemo(
    () => extractApiList<AssignmentProperty>(propertiesQuery.data),
    [propertiesQuery.data],
  );

  // Auto-select all properties when they load
  useEffect(() => {
    if (properties.length > 0) {
      setSelectedProperties(properties.map(p => p.id));
    }
  }, [properties]);

  // Reset properties when clients change
  useEffect(() => {
    if (selectedClients.length === 0) {
      setSelectedProperties([]);
    }
  }, [selectedClients]);

  const loading = propertiesQuery.isFetching;

  // ── Mutation ─────────────────────────────────────────────────────────────

  const assignMutation = useMutation({
    mutationFn: () =>
      managersApi.assignClients(selectedManager as number, {
        clientIds: selectedClients,
        propertyIds: selectedProperties,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: portfoliosKeys.all });
      notify.success(
        `${t('portfolios.errors.assignmentSuccess')} ${result.clientsAssigned ?? 0} client(s) et ${result.propertiesAssigned ?? 0} propriete(s).`,
      );
      setTimeout(() => {
        navigate('/portfolios');
      }, 1500);
    },
    onError: (err: Error) => {
      const errWithDetails = err as Error & { details?: { conflicts?: string[] } };
      if (errWithDetails.details?.conflicts && errWithDetails.details.conflicts.length > 0) {
        notify.error(`Conflits d'assignation : ${errWithDetails.details.conflicts.join(', ')}`);
      } else {
        notify.error(err.message || t('portfolios.errors.assignmentError'));
      }
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    setActiveStep(prev => prev + 1);
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep(prev => prev - 1);
  }, []);

  const handleClientToggle = useCallback((clientId: number) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId],
    );
  }, []);

  const handlePropertyToggle = useCallback((propertyId: number) => {
    setSelectedProperties(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedManager || selectedClients.length === 0 || selectedProperties.length === 0) {
      notify.warning(t('portfolios.errors.assignmentError'));
      return;
    }
    assignMutation.mutate();
  }, [selectedManager, selectedClients, selectedProperties, assignMutation, notify, t]);

  const canGoNext = useMemo(() => {
    switch (activeStep) {
      case 0: return !!selectedManager;
      case 1: return selectedClients.length > 0;
      case 2: return selectedProperties.length > 0;
      default: return true;
    }
  }, [activeStep, selectedManager, selectedClients, selectedProperties]);

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
    hostUsers,
    properties,
    loading,
    // Selections
    selectedManager,
    setSelectedManager,
    selectedClients,
    selectedProperties,
    // Handlers
    handleClientToggle,
    handlePropertyToggle,
    handleSubmit,
    submitting: assignMutation.isPending,
    // Pass-through
    t,
    navigate,
  };
}
