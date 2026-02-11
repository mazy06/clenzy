import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { serviceRequestsApi, teamsApi, usersApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { REQUEST_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequest, ServiceRequestApiResponse, AssignTeam, AssignUser } from './serviceRequestsUtils';

export function useServiceRequestsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequest | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // Fonctions temporaires simplifiees
  const canCancelByWorkflow = (date: string | null | undefined): boolean => {
    return true; // Temporairement toujours true
  };

  const getRemainingCancellationTime = (date: string | null | undefined): number => {
    return 24; // Temporairement toujours 24h
  };

  // Etats pour le changement de statut rapide
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [selectedRequestForStatusChange, setSelectedRequestForStatusChange] = useState<ServiceRequest | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');

  // Etats pour l'assignation de la demande de service
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequestForAssignment, setSelectedRequestForAssignment] = useState<ServiceRequest | null>(null);
  const [assignAssignmentType, setAssignAssignmentType] = useState<'team' | 'user' | 'none'>('none');
  const [assignSelectedTeamId, setAssignSelectedTeamId] = useState<number | null>(null);
  const [assignSelectedUserId, setAssignSelectedUserId] = useState<number | null>(null);
  const [assignTeams, setAssignTeams] = useState<AssignTeam[]>([]);
  const [assignUsers, setAssignUsers] = useState<AssignUser[]>([]);
  const [loadingAssignData, setLoadingAssignData] = useState(false);

  // Etats pour le dialogue de confirmation de validation
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [selectedRequestForValidation, setSelectedRequestForValidation] = useState<ServiceRequest | null>(null);
  const [validating, setValidating] = useState(false);

  // Etats pour les notifications d'erreur/succes
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Charger les demandes de service depuis l'API
  const loadServiceRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serviceRequestsApi.getAll();
      const requestsList = (data as unknown as { content?: ServiceRequestApiResponse[] }).content || data;

      // Convertir les donnees du backend vers le format frontend
      const convertedRequests = (requestsList as unknown as ServiceRequestApiResponse[]).map((req: ServiceRequestApiResponse) => ({
        id: req.id.toString(),
        title: req.title,
        description: req.description,
        type: req.type?.toLowerCase() || req.serviceType?.toLowerCase() || 'other',
        status: req.status || 'PENDING',
        priority: req.priority?.toLowerCase() || 'medium',
        propertyId: req.propertyId,
        propertyName: req.property?.name || 'Propriete inconnue',
        propertyAddress: req.property?.address || '',
        propertyCity: req.property?.city || '',
        requestorId: req.userId || req.requestorId || 0,
        requestorName: req.user ? `${req.user.firstName} ${req.user.lastName}` : (req.requestor ? `${req.requestor.firstName} ${req.requestor.lastName}` : t('serviceRequests.unknownRequestor')),
        assignedToId: req.assignedToId || undefined,
        assignedToName: req.assignedTo ? `${req.assignedTo.firstName} ${req.assignedTo.lastName}` : undefined,
        assignedToType: (req.assignedToType || (req.assignedTo ? 'user' : undefined)) as 'user' | 'team' | undefined,
        estimatedDuration: req.estimatedDurationHours || req.estimatedDuration || 1,
        dueDate: req.desiredDate || req.dueDate || '',
        createdAt: req.createdAt,
      }));

      setServiceRequests(convertedRequests);
    } catch (err) {
      // En cas d'erreur, tableau vide
      setServiceRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les donnees au montage du composant
  useEffect(() => {
    loadServiceRequests();
  }, [loadServiceRequests]);

  // Charger les equipes et utilisateurs pour l'assignation de la demande de service
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
        // Filtrer pour ne garder que les utilisateurs operationnels
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
    // Ne pas fermer le menu ici, sinon selectedServiceRequest devient null
  };

  const confirmDelete = async () => {
    if (selectedServiceRequest) {
      try {
        await serviceRequestsApi.delete(parseInt(selectedServiceRequest.id));
        loadServiceRequests();
      } catch (err) {
      }
    }
    setDeleteDialogOpen(false);
    // Fermer le menu apres la suppression
    handleMenuClose();
  };

  // Fonction pour ouvrir le dialogue de changement de statut
  const handleStatusChange = (request: ServiceRequest) => {
    setSelectedRequestForStatusChange(request);
    setNewStatus(request.status);
    setStatusChangeDialogOpen(true);
  };

  // Fonction pour valider et creer une intervention (seuls managers et admins)
  const handleValidateAndCreateIntervention = (request: ServiceRequest) => {
    // Verifier que la demande est assignee
    if (!request.assignedToId) {
      setErrorMessage(t('serviceRequests.mustAssignBeforeValidation'));
      setErrorDialogOpen(true);
      return;
    }

    // Ouvrir le dialogue de confirmation
    setSelectedRequestForValidation(request);
    setValidateDialogOpen(true);
  };

  // Fonction pour confirmer le changement de statut
  const confirmStatusChange = async () => {
    if (!selectedRequestForStatusChange || !newStatus) return;

    try {
      // Preparer seulement les champs necessaires pour le backend
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

      // Si le statut passe a APPROVED, ouvrir le dialogue de validation avec assignation
      if (newStatus.toUpperCase() === 'APPROVED') {
        setStatusChangeDialogOpen(false);
        handleValidateAndCreateIntervention(selectedRequestForStatusChange);
        setSelectedRequestForStatusChange(null);
        setNewStatus('');
        return; // Sortir de la fonction car on va ouvrir le dialogue de validation
      }

      // Si le statut passe a CANCELLED, annuler aussi l'intervention associee
      if (newStatus.toUpperCase() === 'CANCELLED') {
        // L'annulation de l'intervention associee est geree automatiquement cote serveur
        // lors du changement de statut de la demande de service
      }

      // Mettre a jour la liste locale
      setServiceRequests(prev =>
        prev.map(req =>
          req.id === selectedRequestForStatusChange.id
            ? { ...req, status: newStatus }
            : req
        )
      );
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

      // Recharger la liste pour avoir les donnees a jour
      await loadServiceRequests();

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
      // Utiliser l'assignation de la demande
      if (selectedRequestForValidation.assignedToType === 'team') {
        requestBody.teamId = selectedRequestForValidation.assignedToId;
      } else if (selectedRequestForValidation.assignedToType === 'user') {
        requestBody.userId = selectedRequestForValidation.assignedToId;
      }

      // Note: validate() doesn't accept a body, so we use apiClient.post directly with the body
      const intervention = await apiClient.post(`/service-requests/${selectedRequestForValidation.id}/validate`, requestBody);

      // Sauvegarder le titre avant de reinitialiser l'etat
      const requestTitle = selectedRequestForValidation.title;

      // Recharger la liste pour avoir les donnees a jour
      await loadServiceRequests();

      // Fermer le dialogue de confirmation
      setValidateDialogOpen(false);
      setSelectedRequestForValidation(null);

      // Afficher le message de succes
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

  // Filtrer les demandes de service
  const filteredServiceRequests = serviceRequests.filter((request) => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.propertyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || request.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || request.priority === selectedPriority;

    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  // Verifier si l'utilisateur peut modifier/supprimer cette demande
  const canModifyServiceRequest = (request: ServiceRequest): boolean => {
    if (isAdmin() || isManager()) return true;
    if (isHost() && request.requestorId.toString() === user?.id) return true;
    return false;
  };

  // Verifier si l'utilisateur peut supprimer cette demande
  const canDeleteServiceRequest = (request: ServiceRequest): boolean => {
    // Ne pas permettre la suppression si la demande est approuvee (car intervention creee)
    if (request.status === 'APPROVED') return false;

    // Verifier les permissions utilisateur
    return canModifyServiceRequest(request);
  };

  // Verifier si l'utilisateur peut annuler cette demande
  const canCancelServiceRequest = (request: ServiceRequest): boolean => {
    // Seules les demandes approuvees peuvent etre annulees
    if (request.status !== 'APPROVED') return false;

    // Verifier le delai d'annulation configure
    // Utiliser la date d'approbation si disponible, sinon la date de creation
    const referenceDate = request.approvedAt || request.createdAt;
    if (!canCancelByWorkflow(referenceDate)) return false;

    // Verifier les permissions utilisateur
    return canModifyServiceRequest(request);
  };

  // Generer les types de service avec traductions
  const serviceTypes = [
    { value: 'all', label: t('serviceRequests.allTypes') },
    { value: 'CLEANING', label: 'Nettoyage' },
    { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express' },
    { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur' },
    { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres' },
    { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols' },
    { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine' },
    { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires' },
    { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance Preventive' },
    { value: 'EMERGENCY_REPAIR', label: 'Reparation d\'Urgence' },
    { value: 'ELECTRICAL_REPAIR', label: 'Reparation Electrique' },
    { value: 'PLUMBING_REPAIR', label: 'Reparation Plomberie' },
    { value: 'HVAC_REPAIR', label: 'Reparation Climatisation' },
    { value: 'APPLIANCE_REPAIR', label: 'Reparation Electromenager' },
    { value: 'GARDENING', label: 'Jardinage' },
    { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Exterieur' },
    { value: 'PEST_CONTROL', label: 'Desinsectisation' },
    { value: 'DISINFECTION', label: 'Desinfection' },
    { value: 'RESTORATION', label: 'Remise en Etat' },
    { value: 'OTHER', label: 'Autre' },
  ];

  // Generer les statuts avec traductions
  const statuses = [
    { value: 'all', label: t('serviceRequests.allStatuses') },
    ...REQUEST_STATUS_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
  ];

  // Generer les priorites avec traductions
  const priorities = [
    { value: 'all', label: t('serviceRequests.allPriorities') },
    ...PRIORITY_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
  ];

  return {
    // Filter state
    searchTerm,
    setSearchTerm,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    selectedPriority,
    setSelectedPriority,

    // Menu state
    anchorEl,
    selectedServiceRequest,

    // Data
    serviceRequests,
    loading,
    filteredServiceRequests,

    // Delete dialog
    deleteDialogOpen,
    setDeleteDialogOpen,

    // Status change dialog
    statusChangeDialogOpen,
    setStatusChangeDialogOpen,
    selectedRequestForStatusChange,
    setSelectedRequestForStatusChange,
    newStatus,
    setNewStatus,

    // Assign dialog
    assignDialogOpen,
    selectedRequestForAssignment,
    assignAssignmentType,
    setAssignAssignmentType,
    assignSelectedTeamId,
    setAssignSelectedTeamId,
    assignSelectedUserId,
    setAssignSelectedUserId,
    assignTeams,
    assignUsers,
    loadingAssignData,

    // Validate dialog
    validateDialogOpen,
    setValidateDialogOpen,
    selectedRequestForValidation,
    setSelectedRequestForValidation,
    validating,

    // Error/success dialogs
    errorDialogOpen,
    setErrorDialogOpen,
    errorMessage,
    successDialogOpen,
    setSuccessDialogOpen,
    successMessage,

    // Handlers
    handleMenuOpen,
    handleMenuClose,
    handleEdit,
    handleViewDetails,
    handleDelete,
    confirmDelete,
    handleStatusChange,
    confirmStatusChange,
    handleAssignServiceRequest,
    confirmAssignment,
    closeAssignDialog,
    handleValidateAndCreateIntervention,
    confirmValidation,

    // Permission checks
    canModifyServiceRequest,
    canDeleteServiceRequest,
    canCancelServiceRequest,
    getRemainingCancellationTime,

    // Filter options
    serviceTypes,
    statuses,
    priorities,

    // Auth
    isAdmin,
    isManager,
    isHost,
    navigate,
    t,
  };
}
