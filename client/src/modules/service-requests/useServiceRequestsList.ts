import { getErrorMessage } from "../../utils/getErrorMessage";
import { invalidateMissionWorkflow } from "../../hooks/invalidateMissionWorkflow";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { serviceRequestsApi } from '../../services/api/serviceRequestsApi';
import { teamsApi } from '../../services/api/teamsApi';
import { usersApi } from '../../services/api/usersApi';
import apiClient from '../../services/apiClient';
import { REQUEST_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { useServiceRequestsListQuery, serviceRequestsListKeys } from '../../hooks/useServiceRequestsList';
import { useWorkflowSettings } from '../../hooks/useWorkflowSettings';
import type { ServiceRequest, AssignTeam, AssignUser } from './serviceRequestsUtils';

export function useServiceRequestsList(enabled = true) {
  // ─── React Query for data fetching ──────────────────────────────────
  const {
    serviceRequests,
    isLoading: loading,
    isError: loadFailed,
    refetch,
  } = useServiceRequestsListQuery(enabled);
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequest | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // La cible de suppression est memorisee a part, comme celles du changement de
  // statut et de l'assignation : le menu contextuel se referme des qu'on choisit
  // une entree, ce qui vide `selectedServiceRequest` avant meme que la
  // confirmation ne soit affichee.
  const [selectedRequestForDeletion, setSelectedRequestForDeletion] = useState<ServiceRequest | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyIdParam = searchParams.get('propertyId');
  const { user, isAdmin, isManager, isHost, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // Workflow settings pour le décompte d'annulation et auto-assignation
  const {
    settings: workflowSettings,
    canCancelServiceRequest: canCancelByWorkflow,
    getRemainingCancellationTime,
  } = useWorkflowSettings();

  // Etats pour le changement de statut rapide
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [selectedRequestForStatusChange, setSelectedRequestForStatusChange] = useState<ServiceRequest | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');

  // Etats pour l'assignation
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequestForAssignment, setSelectedRequestForAssignment] = useState<ServiceRequest | null>(null);
  const [assignAssignmentType, setAssignAssignmentType] = useState<'team' | 'user' | 'none'>('none');
  const [assignSelectedTeamId, setAssignSelectedTeamId] = useState<number | null>(null);
  const [assignSelectedUserId, setAssignSelectedUserId] = useState<number | null>(null);
  const [assignTeams, setAssignTeams] = useState<AssignTeam[]>([]);
  const [assignUsers, setAssignUsers] = useState<AssignUser[]>([]);
  const assignmentPending = useRef(false);
  const [assigning, setAssigning] = useState(false);
  const [loadingAssignData, setLoadingAssignData] = useState(false);

  // Etats pour la validation
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [selectedRequestForValidation, setSelectedRequestForValidation] = useState<ServiceRequest | null>(null);
  const [validating, setValidating] = useState(false);

  // Etats pour les notifications
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Charger les equipes et utilisateurs pour l'assignation
  useEffect(() => {
    const loadAssignData = async () => {
      if (!assignDialogOpen) return;
      setLoadingAssignData(true);
      try {
        const [teamsData, usersData] = await Promise.all([
          teamsApi.getAll(),
          usersApi.getAll()
        ]);
        const teamsList = (teamsData as unknown as { content?: AssignTeam[] }).content || teamsData || [];
        setAssignTeams(teamsList as unknown as AssignTeam[]);
        const usersList = (usersData as unknown as { content?: AssignUser[] }).content || usersData || [];
        const operationalUsers = (usersList as unknown as AssignUser[]).filter((u: AssignUser) =>
          ['TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH', 'SUPERVISOR'].includes(u.role)
        );
        setAssignUsers(operationalUsers);
      } catch (err) {
      } finally {
        setLoadingAssignData(false);
      }
    };
    loadAssignData();
  }, [assignDialogOpen]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: serviceRequestsListKeys.all });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, serviceRequest: ServiceRequest) => {
    setAnchorEl(event.currentTarget);
    setSelectedServiceRequest(serviceRequest);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedServiceRequest(null);
  };

  const handleEdit = () => {
    if (selectedServiceRequest) {
      navigate(`/service-requests/${selectedServiceRequest.id}/edit`);
      handleMenuClose();
    }
  };

  const handleViewDetails = () => {
    if (selectedServiceRequest) {
      navigate(`/service-requests/${selectedServiceRequest.id}`);
      handleMenuClose();
    }
  };

  const handleDelete = () => {
    setSelectedRequestForDeletion(selectedServiceRequest);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedRequestForDeletion) {
      try {
        await serviceRequestsApi.delete(parseInt(selectedRequestForDeletion.id));
        invalidateList();
      } catch (err) {
      }
    }
    setDeleteDialogOpen(false);
    setSelectedRequestForDeletion(null);
    handleMenuClose();
  };

  const handleStatusChange = (request: ServiceRequest) => {
    setSelectedRequestForStatusChange(request);
    setNewStatus(request.status);
    setStatusChangeDialogOpen(true);
  };

  const handleValidateAndCreateIntervention = (request: ServiceRequest) => {
    if (!request.assignedToId && !workflowSettings.autoAssignInterventions) {
      setErrorMessage(t('serviceRequests.mustAssignBeforeValidation'));
      setErrorDialogOpen(true);
      return;
    }
    setSelectedRequestForValidation(request);
    setValidateDialogOpen(true);
  };

  const statusPending = useRef(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const confirmStatusChange = async () => {
    if (!selectedRequestForStatusChange || !newStatus || statusPending.current) return;
    statusPending.current = true;
    setChangingStatus(true);
    try {
      await serviceRequestsApi.changeStatus(
        Number(selectedRequestForStatusChange.id),
        selectedRequestForStatusChange.version,
        newStatus.toUpperCase(),
      );

      invalidateList();
      setStatusChangeDialogOpen(false);
      setSelectedRequestForStatusChange(null);
      setNewStatus('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("serviceRequests.updateError")));
      setErrorDialogOpen(true);
    } finally {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: serviceRequestsListKeys.all }),
        invalidateMissionWorkflow(queryClient),
      ]);
      statusPending.current = false;
      setChangingStatus(false);
    }
  };

  const handleAssignServiceRequest = (request: ServiceRequest) => {
    if (assignmentPending.current) return;
    setSelectedRequestForAssignment(request);
    setAssignAssignmentType(request.assignedToType || 'none');
    setAssignSelectedTeamId(request.assignedToType === 'team' ? request.assignedToId || null : null);
    setAssignSelectedUserId(request.assignedToType === 'user' ? request.assignedToId || null : null);
    setAssignDialogOpen(true);
  };

  const confirmAssignment = async () => {
    if (!selectedRequestForAssignment || assignmentPending.current) return;
    const targetId = assignAssignmentType === "team" ? assignSelectedTeamId : assignSelectedUserId;
    if (assignAssignmentType !== "none" && (!targetId || targetId <= 0)) return;
    assignmentPending.current = true;
    setAssigning(true);
    try {
      const id = Number(selectedRequestForAssignment.id);
      if (assignAssignmentType === "none") {
        await serviceRequestsApi.unassign(id);
      } else {
        await serviceRequestsApi.manualAssign(id, targetId!, assignAssignmentType);
      }
      setAssignDialogOpen(false);
      setSelectedRequestForAssignment(null);
      setAssignAssignmentType('none');
      setAssignSelectedTeamId(null);
      setAssignSelectedUserId(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("serviceRequests.assignError")));
      setErrorDialogOpen(true);
    } finally {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: serviceRequestsListKeys.all }),
        invalidateMissionWorkflow(queryClient),
      ]);
      assignmentPending.current = false;
      setAssigning(false);
    }
  };

  const closeAssignDialog = () => {
    if (assignmentPending.current) return;
    setAssignDialogOpen(false);
    setSelectedRequestForAssignment(null);
    setAssignAssignmentType('none');
    setAssignSelectedTeamId(null);
    setAssignSelectedUserId(null);
  };

  const confirmValidation = async () => {
    if (!selectedRequestForValidation) return;
    setValidating(true);
    try {
      const requestBody: Record<string, number | boolean | undefined> = {};
      if (selectedRequestForValidation.assignedToType === 'team') {
        requestBody.teamId = selectedRequestForValidation.assignedToId;
      } else if (selectedRequestForValidation.assignedToType === 'user') {
        requestBody.userId = selectedRequestForValidation.assignedToId;
      }
      // Auto-assign si aucune equipe/user et toggle active
      if (!selectedRequestForValidation.assignedToId && workflowSettings.autoAssignInterventions) {
        requestBody.autoAssign = true;
      }
      const result = await apiClient.post(`/service-requests/${selectedRequestForValidation.id}/validate`, requestBody);
      const requestTitle = selectedRequestForValidation.title;
      invalidateList();
      setValidateDialogOpen(false);
      setSelectedRequestForValidation(null);

      // Verifier si l'auto-assignation a fonctionne
      const intervention = result as Record<string, unknown>;
      if (requestBody.autoAssign && intervention?.teamId) {
        setSuccessMessage(t('serviceRequests.autoAssignedTeam'));
      } else if (requestBody.autoAssign && !intervention?.teamId) {
        setSuccessMessage(t('serviceRequests.autoAssignNoTeamAvailable'));
      } else {
        setSuccessMessage(t('serviceRequests.validateSuccess', { title: requestTitle }));
      }
      setSuccessDialogOpen(true);
    } catch (error) {
      setErrorMessage(t('serviceRequests.validateError'));
      setErrorDialogOpen(true);
    } finally {
      setValidating(false);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredServiceRequests = useMemo(() => {
    return serviceRequests.filter((request) => {
      // Property filter (from URL query param)
      if (propertyIdParam && request.propertyId !== Number(propertyIdParam)) return false;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = request.title.toLowerCase().includes(searchLower) ||
                           request.description.toLowerCase().includes(searchLower) ||
                           request.propertyName.toLowerCase().includes(searchLower);
      const matchesType = selectedType === 'all' || request.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
      const matchesPriority = selectedPriority === 'all' || request.priority === selectedPriority;
      return matchesSearch && matchesType && matchesStatus && matchesPriority;
    });
  }, [serviceRequests, searchTerm, selectedType, selectedStatus, selectedPriority, propertyIdParam]);

  const canModifyServiceRequest = (request: ServiceRequest): boolean => {
    if (isAdmin() || isManager()) return true;
    if (isHost() && request.requestorId.toString() === user?.id) return true;
    return false;
  };

  const canDeleteServiceRequest = (request: ServiceRequest): boolean => {
    if (['ASSIGNED', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'COMPLETED'].includes(request.status)) return false;
    return canModifyServiceRequest(request);
  };

  const canCancelServiceRequest = (request: ServiceRequest): boolean => {
    if (!['PENDING', 'AWAITING_PAYMENT'].includes(request.status)) return false;
    if (!canCancelByWorkflow(request.createdAt)) return false;
    return canModifyServiceRequest(request);
  };

  const serviceTypes = useMemo(() => [
    { value: 'all', label: t('serviceRequests.allTypes') },
    { value: 'CLEANING', label: 'Nettoyage' },
    { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express' },
    { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur' },
    { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres' },
    { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols' },
    { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine' },
    { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires' },
    { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance Préventive' },
    { value: 'EMERGENCY_REPAIR', label: 'Réparation d\'Urgence' },
    { value: 'ELECTRICAL_REPAIR', label: 'Réparation Électrique' },
    { value: 'PLUMBING_REPAIR', label: 'Réparation Plomberie' },
    { value: 'HVAC_REPAIR', label: 'Réparation Climatisation' },
    { value: 'APPLIANCE_REPAIR', label: 'Réparation Électroménager' },
    { value: 'GARDENING', label: 'Jardinage' },
    { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Extérieur' },
    { value: 'PEST_CONTROL', label: 'Désinsectisation' },
    { value: 'DISINFECTION', label: 'Désinfection' },
    { value: 'RESTORATION', label: 'Remise en État' },
    { value: 'OTHER', label: 'Autre' },
  ], [t]);

  const statuses = useMemo(() => [
    { value: 'all', label: t('serviceRequests.allStatuses') },
    ...REQUEST_STATUS_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
  ], [t]);

  const priorities = useMemo(() => [
    { value: 'all', label: t('serviceRequests.allPriorities') },
    ...PRIORITY_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
  ], [t]);

  return {
    searchTerm, setSearchTerm,
    selectedType, setSelectedType,
    selectedStatus, setSelectedStatus,
    selectedPriority, setSelectedPriority,
    anchorEl, selectedServiceRequest,
    serviceRequests, loading, loadFailed, refetch, filteredServiceRequests,
    deleteDialogOpen, setDeleteDialogOpen,
    selectedRequestForDeletion,
    statusChangeDialogOpen, setStatusChangeDialogOpen,
    selectedRequestForStatusChange, setSelectedRequestForStatusChange,
    newStatus, setNewStatus, changingStatus,
    assignDialogOpen, selectedRequestForAssignment,
    assignAssignmentType, setAssignAssignmentType,
    assignSelectedTeamId, setAssignSelectedTeamId,
    assignSelectedUserId, setAssignSelectedUserId,
    assignTeams, assignUsers, loadingAssignData, assigning,
    validateDialogOpen, setValidateDialogOpen,
    selectedRequestForValidation, setSelectedRequestForValidation,
    validating,
    errorDialogOpen, setErrorDialogOpen, errorMessage,
    successDialogOpen, setSuccessDialogOpen, successMessage,
    handleMenuOpen, handleMenuClose,
    handleEdit, handleViewDetails,
    handleDelete, confirmDelete,
    handleStatusChange, confirmStatusChange,
    handleAssignServiceRequest, confirmAssignment, closeAssignDialog,
    handleValidateAndCreateIntervention, confirmValidation,
    canModifyServiceRequest, canDeleteServiceRequest,
    canCancelServiceRequest, getRemainingCancellationTime,
    serviceTypes, statuses, priorities,
    isAdmin, isManager, isHost, navigate, t,
  };
}
