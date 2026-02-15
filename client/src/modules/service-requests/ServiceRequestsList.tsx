import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Badge,
  Tooltip,
  Fab,
  ListItemIcon,
  ListItemText,
  Select,
  FormControl,
  InputLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Schedule,
  Person,
  Category,
  PriorityHigh,
  CleaningServices,
  Build,
  CheckCircle,
  Cancel,
  Description,
  Assignment,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWorkflowSettings } from '../../hooks/useWorkflowSettings';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import ServiceRequestCard from '../../components/ServiceRequestCard';
import { API_CONFIG } from '../../config/api';
import { RequestStatus, REQUEST_STATUS_OPTIONS, Priority, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { createSpacing } from '../../theme/spacing';
import { useTranslation } from '../../hooks/useTranslation';

interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  requestorId: number;
  requestorName: string;
  assignedToId?: number;
  assignedToName?: string;
  assignedToType?: 'user' | 'team';
  estimatedDuration: number;
  dueDate: string;
  createdAt: string;
  approvedAt?: string; // Date d'approbation pour calculer le délai d'annulation
}

// Données mockées supprimées - utilisation de l'API uniquement
// serviceTypes, statuses et priorities seront générés dynamiquement avec les traductions dans le composant

// Utilisation des enums partagés pour les couleurs
const statusColors = Object.fromEntries(
  REQUEST_STATUS_OPTIONS.map(option => [option.value, option.color])
) as Record<RequestStatus, string>;

const priorityColors = Object.fromEntries(
  PRIORITY_OPTIONS.map(option => [option.value, option.color])
) as Record<Priority, string>;

const typeIcons = {
  CLEANING: <CleaningServices />,
  EXPRESS_CLEANING: <CleaningServices />,
  DEEP_CLEANING: <CleaningServices />,
  WINDOW_CLEANING: <CleaningServices />,
  FLOOR_CLEANING: <CleaningServices />,
  KITCHEN_CLEANING: <CleaningServices />,
  BATHROOM_CLEANING: <CleaningServices />,
  PREVENTIVE_MAINTENANCE: <Build />,
  EMERGENCY_REPAIR: <Build />,
  ELECTRICAL_REPAIR: <Build />,
  PLUMBING_REPAIR: <Build />,
  HVAC_REPAIR: <Build />,
  APPLIANCE_REPAIR: <Build />,
  GARDENING: <Build />,
  EXTERIOR_CLEANING: <CleaningServices />,
  PEST_CONTROL: <Build />,
  DISINFECTION: <CleaningServices />,
  RESTORATION: <Build />,
  OTHER: <Category />,
};

export default function ServiceRequestsList() {
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
  // Temporairement désactivé pour déboguer
  // const { canCancelServiceRequest: canCancelByWorkflow, getRemainingCancellationTime } = useWorkflowSettings();
  
  // Fonctions temporaires simplifiées
  const canCancelByWorkflow = (date: string | null | undefined): boolean => {
    console.log('🔍 Fonction temporaire canCancelByWorkflow appelée avec:', date);
    return true; // Temporairement toujours true
  };
  
  const getRemainingCancellationTime = (date: string | null | undefined): number => {
    console.log('🔍 Fonction temporaire getRemainingCancellationTime appelée avec:', date);
    return 24; // Temporairement toujours 24h
  };

  // États pour le changement de statut rapide
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [selectedRequestForStatusChange, setSelectedRequestForStatusChange] = useState<ServiceRequest | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  
  
  // États pour l'assignation de la demande de service
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequestForAssignment, setSelectedRequestForAssignment] = useState<ServiceRequest | null>(null);
  const [assignAssignmentType, setAssignAssignmentType] = useState<'team' | 'user' | 'none'>('none');
  const [assignSelectedTeamId, setAssignSelectedTeamId] = useState<number | null>(null);
  const [assignSelectedUserId, setAssignSelectedUserId] = useState<number | null>(null);
  const [assignTeams, setAssignTeams] = useState<any[]>([]);
  const [assignUsers, setAssignUsers] = useState<any[]>([]);
  const [loadingAssignData, setLoadingAssignData] = useState(false);

  // États pour le dialogue de confirmation de validation
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [selectedRequestForValidation, setSelectedRequestForValidation] = useState<ServiceRequest | null>(null);
  const [validating, setValidating] = useState(false);
  
  // États pour les notifications d'erreur/succès
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Charger les demandes de service depuis l'API
  const loadServiceRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const requestsList = data.content || data;
        
        // Convertir les données du backend vers le format frontend
        const convertedRequests = requestsList.map((req: any) => ({
          id: req.id.toString(),
          title: req.title,
          description: req.description,
          type: req.type?.toLowerCase() || req.serviceType?.toLowerCase() || 'other',
          status: req.status || 'PENDING',
          priority: req.priority?.toLowerCase() || 'medium',
          propertyId: req.propertyId,
          propertyName: req.property?.name || 'Propriété inconnue',
          propertyAddress: req.property?.address || '',
          propertyCity: req.property?.city || '',
          requestorId: req.userId || req.requestorId,
          requestorName: req.user ? `${req.user.firstName} ${req.user.lastName}` : (req.requestor ? `${req.requestor.firstName} ${req.requestor.lastName}` : t('serviceRequests.unknownRequestor')),
          assignedToId: req.assignedToId || undefined,
          assignedToName: req.assignedTo ? `${req.assignedTo.firstName} ${req.assignedTo.lastName}` : undefined,
          assignedToType: req.assignedToType || (req.assignedTo ? 'user' : undefined),
          estimatedDuration: req.estimatedDurationHours || req.estimatedDuration || 1,
          dueDate: req.desiredDate || req.dueDate,
          createdAt: req.createdAt,
        }));

        setServiceRequests(convertedRequests);
      } else {
        // En cas d'erreur, tableau vide
        setServiceRequests([]);
      }
    } catch (err) {
      // En cas d'erreur, tableau vide
      setServiceRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les données au montage du composant
  useEffect(() => {
    loadServiceRequests();
  }, [loadServiceRequests]);





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
    console.log('🔍 handleDelete appelé pour:', selectedServiceRequest);
    console.log('🔍 Utilisateur actuel:', user);
    console.log('🔍 isAdmin():', isAdmin());
    console.log('🔍 isManager():', isManager());
    console.log('🔍 canModifyServiceRequest:', canModifyServiceRequest(selectedServiceRequest!));
    setDeleteDialogOpen(true);
    // Ne pas fermer le menu ici, sinon selectedServiceRequest devient null
  };

  const confirmDelete = async () => {
    console.log('🔍 confirmDelete appelé pour:', selectedServiceRequest);
    if (selectedServiceRequest) {
      try {
        console.log('🔍 Tentative de suppression via API...');
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${selectedServiceRequest.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        console.log('🔍 Réponse API:', response.status, response.statusText);
        
        if (response.ok) {
          console.log('🔍 Suppression réussie, mise à jour de la liste...');
          loadServiceRequests();
        } else {
          console.error('🔍 Erreur API lors de la suppression:', response.status, response.statusText);
          // Essayer de lire le message d'erreur
          try {
            const errorData = await response.text();
            console.error('🔍 Détails de l\'erreur:', errorData);
          } catch (e) {
            console.error('🔍 Impossible de lire les détails de l\'erreur');
          }
        }
      } catch (err) {
        console.error('🔍 Erreur lors de la suppression:', err);
      }
    }
    setDeleteDialogOpen(false);
    // Fermer le menu après la suppression
    handleMenuClose();
  };

  // Fonction pour ouvrir le dialogue de changement de statut
  const handleStatusChange = (request: ServiceRequest) => {
    setSelectedRequestForStatusChange(request);
    setNewStatus(request.status);
    setStatusChangeDialogOpen(true);
  };

  // Fonction pour confirmer le changement de statut
  const confirmStatusChange = async () => {
    if (!selectedRequestForStatusChange || !newStatus) return;

    try {
      // Préparer seulement les champs nécessaires pour le backend
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

      console.log('🔍 Données envoyées pour mise à jour:', updateData);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${selectedRequestForStatusChange.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Si le statut passe à APPROVED, ouvrir le dialogue de validation avec assignation
        if (newStatus.toUpperCase() === 'APPROVED') {
          setStatusChangeDialogOpen(false);
          handleValidateAndCreateIntervention(selectedRequestForStatusChange);
          setSelectedRequestForStatusChange(null);
          setNewStatus('');
          return; // Sortir de la fonction car on va ouvrir le dialogue de validation
        }

        // Si le statut passe à CANCELLED, annuler aussi l'intervention associée
        if (newStatus.toUpperCase() === 'CANCELLED') {
          try {
            console.log('🔍 Statut passé à CANCELLED, annulation de l\'intervention...');
            // TODO: Appeler l'endpoint pour annuler l'intervention
            // Pour l'instant, on se contente de changer le statut de la demande
            console.log('🔍 Demande annulée, intervention à annuler manuellement pour l\'instant');
          } catch (cancellationError) {
            console.error('🔍 Erreur lors de l\'annulation:', cancellationError);
          }
        }

        // Mettre à jour la liste locale
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
      } else {
        console.error('Erreur lors de la mise à jour du statut:', response.status, response.statusText);
        // Essayer de lire le message d'erreur
        try {
          const errorData = await response.text();
          console.error('🔍 Détails de l\'erreur:', errorData);
        } catch (e) {
          console.error('🔍 Impossible de lire les détails de l\'erreur');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
    }
  };

  // Fonction pour valider et créer une intervention (seuls managers et admins)

  // Charger les équipes et utilisateurs pour l'assignation de la demande de service
  useEffect(() => {
    const loadAssignData = async () => {
      if (!assignDialogOpen) return;
      
      setLoadingAssignData(true);
      try {
        const [teamsRes, usersRes] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            },
          }),
          fetch(`${API_CONFIG.BASE_URL}/api/users`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            },
          })
        ]);

        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          setAssignTeams(teamsData.content || teamsData || []);
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const usersList = usersData.content || usersData || [];
          // Filtrer pour ne garder que les utilisateurs opérationnels
          const operationalUsers = usersList.filter((u: any) => 
            ['TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'].includes(u.role)
          );
          setAssignUsers(operationalUsers);
        }
      } catch (err) {
        console.error('Erreur chargement équipes/utilisateurs pour assignation:', err);
      } finally {
        setLoadingAssignData(false);
      }
    };

    loadAssignData();
  }, [assignDialogOpen]);

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
      const updateData: any = {
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

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${selectedRequestForAssignment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Recharger la liste pour avoir les données à jour
        await loadServiceRequests();
        
        setAssignDialogOpen(false);
        setSelectedRequestForAssignment(null);
        setAssignAssignmentType('none');
        setAssignSelectedTeamId(null);
        setAssignSelectedUserId(null);
        
        console.log('Demande assignée avec succès');
      } else {
        const errorData = await response.text();
        console.error('Erreur lors de l\'assignation:', response.status, errorData);
        alert('Erreur lors de l\'assignation: ' + errorData);
      }
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      alert('Erreur lors de l\'assignation');
    }
  };

  const handleValidateAndCreateIntervention = (request: ServiceRequest) => {
    // Vérifier que la demande est assignée
    if (!request.assignedToId) {
      setErrorMessage(t('serviceRequests.mustAssignBeforeValidation'));
      setErrorDialogOpen(true);
      return;
    }
    
    // Ouvrir le dialogue de confirmation
    setSelectedRequestForValidation(request);
    setValidateDialogOpen(true);
  };

  const confirmValidation = async () => {
    if (!selectedRequestForValidation) return;
    
    setValidating(true);
    
    try {
      const requestBody: any = {};
      // Utiliser l'assignation de la demande
      if (selectedRequestForValidation.assignedToType === 'team') {
        requestBody.teamId = selectedRequestForValidation.assignedToId;
      } else if (selectedRequestForValidation.assignedToType === 'user') {
        requestBody.userId = selectedRequestForValidation.assignedToId;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${selectedRequestForValidation.id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const intervention = await response.json();
        console.log('🔍 Intervention créée avec succès:', intervention);
        
        // Sauvegarder le titre avant de réinitialiser l'état
        const requestTitle = selectedRequestForValidation.title;
        
        // Recharger la liste pour avoir les données à jour
        await loadServiceRequests();
        
        // Fermer le dialogue de confirmation
        setValidateDialogOpen(false);
        setSelectedRequestForValidation(null);
        
        // Afficher le message de succès
        setSuccessMessage(t('serviceRequests.validateSuccess', { title: requestTitle }));
        setSuccessDialogOpen(true);
      } else {
        const errorData = await response.text();
        console.error('Erreur lors de la validation:', response.status, errorData);
        setErrorMessage(t('serviceRequests.validateError') + ': ' + errorData);
        setErrorDialogOpen(true);
      }
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      setErrorMessage(t('serviceRequests.validateError'));
      setErrorDialogOpen(true);
    } finally {
      setValidating(false);
    }
  };


  // Filtrer les demandes de service
  const getFilteredServiceRequests = () => {
    return serviceRequests.filter((request) => {
      const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           request.propertyName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || request.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
      const matchesPriority = selectedPriority === 'all' || request.priority === selectedPriority;
      
      return matchesSearch && matchesType && matchesStatus && matchesPriority;
    });
  };

  const filteredServiceRequests = getFilteredServiceRequests();

  // Vérifier si l'utilisateur peut modifier/supprimer cette demande
  const canModifyServiceRequest = (request: ServiceRequest): boolean => {
    if (isAdmin() || isManager()) return true;
    if (isHost() && request.requestorId.toString() === user?.id) return true;
    return false;
  };

  // Vérifier si l'utilisateur peut supprimer cette demande
  const canDeleteServiceRequest = (request: ServiceRequest): boolean => {
    // Ne pas permettre la suppression si la demande est approuvée (car intervention créée)
    if (request.status === 'APPROVED') return false;
    
    // Vérifier les permissions utilisateur
    return canModifyServiceRequest(request);
  };

  // Vérifier si l'utilisateur peut annuler cette demande
  const canCancelServiceRequest = (request: ServiceRequest): boolean => {
    // Seules les demandes approuvées peuvent être annulées
    if (request.status !== 'APPROVED') return false;
    
    // Vérifier le délai d'annulation configuré
    // Utiliser la date d'approbation si disponible, sinon la date de création
    const referenceDate = request.approvedAt || request.createdAt;
    if (!canCancelByWorkflow(referenceDate)) return false;
    
    // Vérifier les permissions utilisateur
    return canModifyServiceRequest(request);
  };

  const formatDuration = (duration: number): string => {
    if (duration === 0.5) return '30 min';
    if (duration === 1) return '1h';
    if (duration === 1.5) return '1h30';
    return `${duration}h`;
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Non définie';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Erreur de formatage de date:', error, 'pour la date:', dateString);
      return 'Date invalide';
    }
  };



  // Générer les types de service avec traductions
  const serviceTypes = [
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
  ];

  // Générer les statuts avec traductions
  const statuses = [
    { value: 'all', label: t('serviceRequests.allStatuses') },
    ...REQUEST_STATUS_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
  ];

  // Générer les priorités avec traductions
  const priorities = [
    { value: 'all', label: t('serviceRequests.allPriorities') },
    ...PRIORITY_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
  ];

  return (
    <Box>
      <PageHeader
        title={t('serviceRequests.title')}
        subtitle={t('serviceRequests.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => navigate('/service-requests/new')}
            size="small"
          >
            {t('serviceRequests.create')}
          </Button>
        }
      />

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('serviceRequests.search')}
        filters={{
          type: {
            value: selectedType,
            options: serviceTypes,
            onChange: setSelectedType,
            label: t('common.type')
          },
          status: {
            value: selectedStatus,
            options: statuses,
            onChange: setSelectedStatus,
            label: t('common.status')
          },
          priority: {
            value: selectedPriority,
            options: priorities,
            onChange: setSelectedPriority,
            label: t('serviceRequests.fields.priority')
          }
        }}
        counter={{
          label: t('serviceRequests.request'),
          count: filteredServiceRequests.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des demandes de service */}
      <Grid container spacing={2}>
        {filteredServiceRequests.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ textAlign: 'center', py: 2.5, px: 2, ...createSpacing.card() }}>
              <CardContent>
                <Box sx={{ mb: 1.5 }}>
                  <Description sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.6 }} />
                </Box>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('serviceRequests.noRequestFound')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {isAdmin() || isManager() 
                    ? t('serviceRequests.noRequestCreated')
                    : t('serviceRequests.noRequestAssigned')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                  {t('serviceRequests.requestsDescription')}
                </Typography>
                {(false || isAdmin() || isManager() || isHost()) && (
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => navigate('/service-requests/new')}
                      size="small"
                      sx={{ borderRadius: 1.5 }}
                    >
                      {t('serviceRequests.createFirst')}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredServiceRequests.map((request) => (
            <Grid item xs={12} md={6} lg={4} key={request.id}>
              <ServiceRequestCard
                request={request}
                onMenuOpen={handleMenuOpen}
                typeIcons={typeIcons}
                statuses={statuses}
                priorities={priorities}
                statusColors={statusColors}
                priorityColors={priorityColors}
              />
            </Grid>
          ))
        )}
      </Grid>

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          {t('serviceRequests.viewDetails')}
        </MenuItem>
        
        {/* Action d'assignation - visible pour managers et admins si la demande n'est pas assignée */}
        {(isAdmin() || isManager()) && selectedServiceRequest?.status === 'PENDING' && !selectedServiceRequest.assignedToId && (
          <MenuItem onClick={() => {
            handleAssignServiceRequest(selectedServiceRequest);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <Assignment fontSize="small" color="primary" />
            </ListItemIcon>
            {t('serviceRequests.assign')}
          </MenuItem>
        )}
        
        {/* Action de validation et création d'intervention - visible pour managers et admins seulement si assignée */}
        {(isAdmin() || isManager()) && selectedServiceRequest?.status === 'PENDING' && selectedServiceRequest.assignedToId && (
          <MenuItem onClick={() => {
            handleValidateAndCreateIntervention(selectedServiceRequest);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <CheckCircle fontSize="small" color="success" />
            </ListItemIcon>
            {t('serviceRequests.validateAndCreateIntervention')}
          </MenuItem>
        )}
        
        {/* Option de modification - toujours visible si permissions */}
        {selectedServiceRequest && canModifyServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            {t('serviceRequests.modify')}
          </MenuItem>
        )}
        
        {/* Option de suppression - seulement si pas approuvée */}
        {selectedServiceRequest && canDeleteServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            {t('serviceRequests.delete')}
          </MenuItem>
        )}
        
        {/* Option d'annulation - seulement si approuvée */}
        {selectedServiceRequest && canCancelServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={() => {
            setSelectedRequestForStatusChange(selectedServiceRequest);
            setNewStatus('CANCELLED');
            setStatusChangeDialogOpen(true);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <Cancel fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText
              primary={t('serviceRequests.cancel')}
              secondary={`Temps restant: ${Math.round(getRemainingCancellationTime(selectedServiceRequest.approvedAt || selectedServiceRequest.createdAt))}h`}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>{t('serviceRequests.confirmDelete')}</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2">
            {t('serviceRequests.confirmDeleteMessage', { title: selectedServiceRequest?.title })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small">{t('common.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">
            {t('serviceRequests.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de changement de statut */}
      <Dialog open={statusChangeDialogOpen} onClose={() => setStatusChangeDialogOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>{t('serviceRequests.changeStatus')}</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="caption" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
            {t('serviceRequests.changeStatusMessage', { title: selectedRequestForStatusChange?.title })}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>{t('serviceRequests.newStatus')}</InputLabel>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              label="Nouveau statut"
              size="small"
            >
              {statuses
                .filter(status => status.value !== 'all')
                .map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setStatusChangeDialogOpen(false)} size="small">{t('common.cancel')}</Button>
          <Button onClick={confirmStatusChange} variant="contained" size="small">
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Dialogue d'assignation de la demande de service */}
      <Dialog 
        open={assignDialogOpen} 
        onClose={() => {
          setAssignDialogOpen(false);
          setSelectedRequestForAssignment(null);
          setAssignAssignmentType('none');
          setAssignSelectedTeamId(null);
          setAssignSelectedUserId(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('serviceRequests.assign')}
        </DialogTitle>
        <DialogContent>
          {selectedRequestForAssignment && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('serviceRequests.assign')}: <strong>{selectedRequestForAssignment.title}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('serviceRequests.assignDescription')}
              </Typography>
            </Box>
          )}
          
          <FormControl component="fieldset" sx={{ width: '100%', mt: 2 }}>
            <FormLabel component="legend">{t('serviceRequests.assignmentType')}</FormLabel>
            <RadioGroup
              value={assignAssignmentType}
              onChange={(e) => {
                const newType = e.target.value as 'team' | 'user' | 'none';
                setAssignAssignmentType(newType);
                if (newType === 'team') {
                  setAssignSelectedUserId(null);
                } else if (newType === 'user') {
                  setAssignSelectedTeamId(null);
                } else {
                  setAssignSelectedTeamId(null);
                  setAssignSelectedUserId(null);
                }
              }}
            >
              <FormControlLabel value="team" control={<Radio />} label={t('serviceRequests.fields.team')} />
              {assignAssignmentType === 'team' && (
                <FormControl fullWidth sx={{ ml: 4, mt: 1, mb: 2 }}>
                  <InputLabel>{t('serviceRequests.fields.team')}</InputLabel>
                  <Select
                    value={assignSelectedTeamId || ''}
                    onChange={(e) => setAssignSelectedTeamId(e.target.value as number)}
                    label={t('serviceRequests.fields.team')}
                    disabled={loadingAssignData}
                  >
                    {assignTeams.length === 0 && !loadingAssignData && (
                      <MenuItem disabled>{t('serviceRequests.noTeamsAvailable')}</MenuItem>
                    )}
                    {assignTeams.map((team) => (
                      <MenuItem key={team.id} value={team.id}>
                        {team.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              
              <FormControlLabel value="user" control={<Radio />} label={t('serviceRequests.fields.assignedToUser')} />
              {assignAssignmentType === 'user' && (
                <FormControl fullWidth sx={{ ml: 4, mt: 1, mb: 2 }}>
                  <InputLabel>{t('serviceRequests.fields.assignedToUser')}</InputLabel>
                  <Select
                    value={assignSelectedUserId || ''}
                    onChange={(e) => setAssignSelectedUserId(e.target.value as number)}
                    label={t('serviceRequests.fields.assignedToUser')}
                    disabled={loadingAssignData}
                  >
                    {assignUsers.length === 0 && !loadingAssignData && (
                      <MenuItem disabled>{t('serviceRequests.noUsersAvailable')}</MenuItem>
                    )}
                    {assignUsers.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              
              <FormControlLabel value="none" control={<Radio />} label={t('serviceRequests.fields.noAssignment')} />
            </RadioGroup>
          </FormControl>
          
          {loadingAssignData && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAssignDialogOpen(false);
            setSelectedRequestForAssignment(null);
            setAssignAssignmentType('none');
            setAssignSelectedTeamId(null);
            setAssignSelectedUserId(null);
          }}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={confirmAssignment} 
            variant="contained" 
            color="primary"
            disabled={loadingAssignData || (assignAssignmentType === 'team' && !assignSelectedTeamId) || (assignAssignmentType === 'user' && !assignSelectedUserId)}
          >
            {t('serviceRequests.assign')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue de confirmation de validation */}
      <Dialog 
        open={validateDialogOpen} 
        onClose={() => {
          if (!validating) {
            setValidateDialogOpen(false);
            setSelectedRequestForValidation(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle color="success" />
          {t('serviceRequests.validateAndCreateIntervention')}
        </DialogTitle>
        <DialogContent>
          {selectedRequestForValidation && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {t('serviceRequests.confirmValidation', { title: selectedRequestForValidation.title })}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('serviceRequests.validateAndCreateInterventionDescription')}
              </Typography>
              {selectedRequestForValidation.assignedToName && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {selectedRequestForValidation.assignedToType === 'team' ? t('serviceRequests.fields.team') : t('serviceRequests.fields.assignedToUser')}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {selectedRequestForValidation.assignedToName}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button 
            onClick={() => {
              setValidateDialogOpen(false);
              setSelectedRequestForValidation(null);
            }}
            disabled={validating}
            size="small"
          >
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={confirmValidation} 
            variant="contained" 
            color="success"
            disabled={validating}
            size="small"
            startIcon={validating ? <CircularProgress size={16} /> : <CheckCircle />}
          >
            {validating ? t('common.processing') : t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue d'erreur */}
      <Dialog 
        open={errorDialogOpen} 
        onClose={() => setErrorDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <Cancel color="error" />
          {t('common.error')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {errorMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button 
            onClick={() => setErrorDialogOpen(false)} 
            variant="contained" 
            color="error"
            size="small"
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue de succès */}
      <Dialog 
        open={successDialogOpen} 
        onClose={() => setSuccessDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
          <CheckCircle color="success" />
          {t('common.success')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {successMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button 
            onClick={() => setSuccessDialogOpen(false)} 
            variant="contained" 
            color="success"
            size="small"
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
