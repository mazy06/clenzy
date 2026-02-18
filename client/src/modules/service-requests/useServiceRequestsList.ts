import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { serviceRequestsApi, teamsApi, usersApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { REQUEST_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { useServiceRequestsListQuery, serviceRequestsListKeys } from '../../hooks/useServiceRequestsList';
import type { ServiceRequest, AssignTeam, AssignUser } from './serviceRequestsUtils';

export function useServiceRequestsList() {
  // ─── React Query for data fetching ──────────────────────────────────
  const {
    serviceRequests,
    isLoading: loading,
    refetch,
  } = useServiceRequestsListQuery();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequest | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // Fonctions temporaires simplifiees
  const canCancelByWorkflow = (date: string | null | undefined): boolean => {
    return true;
  };

  const getRemainingCancellationTime = (date: string | null | undefined): number => {
    return 24;
  };

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
          ['TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'].includes(u.role)
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
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedServiceRequest) {
      try {
        await serviceRequestsApi.delete(parseInt(selectedServiceRequest.id));
        invalidateList();
      } catch (err) {
      }
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const handleStatusChange = (request: ServiceRequest) => {
    setSelectedRequestForStatusChange(request);
    setNewStatus(request.status);
    setStatusChangeDialogOpen(true);
  };

  const handleValidateAndCreateIntervention = (request: ServiceRequest) => {
    if (!request.assignedToId) {
      setErrorMessage(t('serviceRequests.mustAssignBeforeValidation'));
      setErrorDialogOpen(true);
      return;
    }
    setSelectedRequestForValidation(request);
    setValidateDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedRequestForStatusChange || !newStatus) return;
    try {
      const updateData = {
        id: parseInt(selectedRequestForStatusChange.id),
        title: selectedRequestForStatusChange.title,
        description: selectedRequestForStatusChange.description,
        serviceType: selectedRequestForStatusChange.type.toUpperCase(),
        priority: selectedRequestForStatusChange.priority.toUpperCase(),
        status: newStatus.toUpperCase(),
        desiredDate: selectedRequestForStatusChange.dueDate,
        estimatedDurationHours: selectedRequestForStatusChange.estimatedDuration,
        userId: selectedRequestForStatusChange.requestorId,
        propertyId: selectedRequestForStatusChange.propertyId,
      };
      await serviceRequestsApi.update(parseInt(selectedRequestForStatusChange.id), updateData);

      if (newStatus.toUpperCase() === 'APPROVED') {
        setStatusChangeDialogOpen(false);
        handleValidateAndCreateIntervention(selectedRequestForStatusChange);
        setSelectedRequestForStatusChange(null);
        setNewStatus('');
        return;
      }

      invalidateList();
      setStatusChangeDialogOpen(false);
      setSelectedRequestForStatusChange(null);
      setNewStatus('');
    } catch (error) {
    }
  };

  const handleAssignServiceRequest = (request: ServiceRequest) => {
    setSelectedRequestForAssignment(request);
    setAssignAssignmentType(request.assignedToType || 'none');
    setAssignSelectedTeamId(request.assignedToType === 'team' ? request.assignedToId || null : null);
    setAssignSelectedUserId(request.assignedToType === 'user' ? request.assignedToId || null : null);
    setAssignDialogOpen(true);
  };

  const confirmAssignment = async () => {
    if (!selectedRequestForAssignment) return;
    try {
      const updateData: Record<string, string | number | null> = {
        id: parseInt(selectedRequestForAssignment.id),
        title: selectedRequestForAssignment.title,
        description: selectedRequestForAssignment.description,
        serviceType: selectedRequestForAssignment.type.toUpperCase(),
        priority: selectedRequestForAssignment.priority.toUpperCase(),
        status: selectedRequestForAssignment.status,
        desiredDate: selectedRequestForAssignment.dueDate,
        estimatedDurationHours: selectedRequestForAssignment.estimatedDuration,
        userId: selectedRequestForAssignment.requestorId,
        propertyId: selectedRequestForAssignment.propertyId,
      };
      if (assignSelectedTeamId) {
        updateData.assignedToId = assignSelectedTeamId;
        updateData.assignedToType = 'team';
      } else if (assignSelectedUserId) {
        updateData.assignedToId = assignSelectedUserId;
        updateData.assignedToType = 'user';
      } else {
        updateData.assignedToId = null;
        updateData.assignedToType = null;
      }
      await serviceRequestsApi.update(parseInt(selectedRequestForAssignment.id), updateData);
      invalidateList();
      setAssignDialogOpen(false);
      setSelectedRequestForAssignment(null);
      setAssignAssignmentType('none');
      setAssignSelectedTeamId(null);
      setAssignSelectedUserId(null);
    } catch (error) {
      alert('Erreur lors de l\'assignation');
    }
  };

  const closeAssignDialog = () => {
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
      const requestBody: Record<string, number | undefined> = {};
      if (selectedRequestForValidation.assignedToType === 'team') {
        requestBody.teamId = selectedRequestForValidation.assignedToId;
      } else if (selectedRequestForValidation.assignedToType === 'user') {
        requestBody.userId = selectedRequestForValidation.assignedToId;
      }
      await apiClient.post(`/service-requests/${selectedRequestForValidation.id}/validate`, requestBody);
      const requestTitle = selectedRequestForValidation.title;
      invalidateList();
      setValidateDialogOpen(false);
      setSelectedRequestForValidation(null);
      setSuccessMessage(t('serviceRequests.validateSuccess', { title: requestTitle }));
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
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = request.title.toLowerCase().includes(searchLower) ||
                           request.description.toLowerCase().includes(searchLower) ||
                           request.propertyName.toLowerCase().includes(searchLower);
      const matchesType = selectedType === 'all' || request.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
      const matchesPriority = selectedPriority === 'all' || request.priority === selectedPriority;
      return matchesSearch && matchesType && matchesStatus && matchesPriority;
    });
  }, [serviceRequests, searchTerm, selectedType, selectedStatus, selectedPriority]);

  const canModifyServiceRequest = (request: ServiceRequest): boolean => {
    if (isAdmin() || isManager()) return true;
    if (isHost() && request.requestorId.toString() === user?.id) return true;
    return false;
  };

  const canDeleteServiceRequest = (request: ServiceRequest): boolean => {
    if (request.status === 'APPROVED') return false;
    return canModifyServiceRequest(request);
  };

  const canCancelServiceRequest = (request: ServiceRequest): boolean => {
    if (request.status !== 'APPROVED') return false;
    const referenceDate = request.approvedAt || request.createdAt;
    if (!canCancelByWorkflow(referenceDate)) return false;
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
    serviceRequests, loading, filteredServiceRequests,
    deleteDialogOpen, setDeleteDialogOpen,
    statusChangeDialogOpen, setStatusChangeDialogOpen,
    selectedRequestForStatusChange, setSelectedRequestForStatusChange,
    newStatus, setNewStatus,
    assignDialogOpen, selectedRequestForAssignment,
    assignAssignmentType, setAssignAssignmentType,
    assignSelectedTeamId, setAssignSelectedTeamId,
    assignSelectedUserId, setAssignSelectedUserId,
    assignTeams, assignUsers, loadingAssignData,
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
