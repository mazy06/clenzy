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

const serviceTypes = [
  { value: 'all', label: 'Tous les types' },
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

// Utilisation des enums partagés pour les statuts
const statuses = [
  { value: 'all', label: 'Tous les statuts' },
  ...REQUEST_STATUS_OPTIONS.map(option => ({
    value: option.value,
    label: option.label
  }))
];

// Utilisation des enums partagés pour les priorités
const priorities = [
  { value: 'all', label: 'Toutes priorités' },
  ...PRIORITY_OPTIONS.map(option => ({
    value: option.value,
    label: option.label
  }))
];

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
          type: req.type?.toLowerCase() || 'other',
          status: req.status || 'PENDING',
          priority: req.priority?.toLowerCase() || 'medium',
          propertyId: req.propertyId,
          propertyName: req.property?.name || 'Propriété inconnue',
          propertyAddress: req.property?.address || '',
          propertyCity: req.property?.city || '',
          requestorId: req.requestorId,
          requestorName: req.requestor ? `${req.requestor.firstName} ${req.requestor.lastName}` : 'Demandeur inconnu',
          assignedToId: req.assignedToId,
          assignedToName: req.assignedTo ? `${req.assignedTo.firstName} ${req.assignedTo.lastName}` : undefined,
          assignedToType: req.assignedToType || (req.assignedTo ? 'user' : undefined),
          estimatedDuration: req.estimatedDuration || 1,
          dueDate: req.desiredDate,
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
        // Si le statut passe à APPROVED, utiliser l'endpoint /validate au lieu de /update
        if (newStatus.toUpperCase() === 'APPROVED') {
          try {
            console.log('🔍 Statut passé à APPROVED, utilisation de l\'endpoint /validate...');
            const interventionResponse = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${selectedRequestForStatusChange.id}/validate`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
              },
            });

            if (interventionResponse.ok) {
              const intervention = await interventionResponse.json();
              console.log('🔍 Intervention créée avec succès:', intervention);
              
              // Mettre à jour la liste locale avec le nouveau statut
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
              return; // Sortir de la fonction car l'intervention est déjà créée
            } else {
              console.error('🔍 Erreur lors de la création de l\'intervention:', interventionResponse.status);
              const errorData = await interventionResponse.text();
              console.error('🔍 Détails de l\'erreur:', errorData);
              // Continuer avec la mise à jour normale du statut
            }
          } catch (interventionError) {
            console.error('🔍 Erreur lors de la création de l\'intervention:', interventionError);
            // Continuer avec la mise à jour normale du statut
          }
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
  const handleValidateAndCreateIntervention = async (request: ServiceRequest) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${request.id}/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        // Mettre à jour la liste locale avec le nouveau statut
        setServiceRequests(prev => 
          prev.map(req => 
            req.id === request.id 
              ? { ...req, status: 'APPROVED' }
              : req
          )
        );
        // Optionnel : afficher un message de succès
        console.log('Demande validée et intervention créée avec succès');
      } else {
        console.error('Erreur lors de la validation de la demande');
      }
    } catch (error) {
      console.error('Erreur lors de la validation de la demande:', error);
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



  return (
    <Box>
      <PageHeader
        title="Demandes de service"
        subtitle="Gestion des demandes de maintenance et nettoyage"
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
            Nouvelle demande
          </Button>
        }
      />

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher une demande..."
        filters={{
          type: {
            value: selectedType,
            options: serviceTypes,
            onChange: setSelectedType,
            label: "Type"
          },
          status: {
            value: selectedStatus,
            options: statuses,
            onChange: setSelectedStatus,
            label: "Statut"
          },
          priority: {
            value: selectedPriority,
            options: priorities,
            onChange: setSelectedPriority,
            label: "Priorité"
          }
        }}
        counter={{
          label: "demande",
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
                  Aucune demande de service
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {isAdmin() || isManager() 
                    ? "Aucune demande de service n'a encore été créée dans le système."
                    : "Aucune demande de service ne vous est actuellement assignée."}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                  Les demandes de service permettent de gérer les besoins de nettoyage, maintenance et réparation de vos propriétés.
                </Typography>
                {(false || isAdmin() || isManager() || isHost()) && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate('/service-requests/new')}
                    size="small"
                    sx={{ borderRadius: 1.5 }}
                  >
                    Créer votre première demande
                  </Button>
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
                onStatusChange={handleStatusChange}
                canChangeStatus={isAdmin() || isManager()}
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
          Voir détails
        </MenuItem>
        
        {/* Action de validation et création d'intervention - visible pour managers et admins */}
        {(isAdmin() || isManager()) && selectedServiceRequest?.status === 'PENDING' && (
          <MenuItem onClick={() => {
            handleValidateAndCreateIntervention(selectedServiceRequest);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <CheckCircle fontSize="small" color="success" />
            </ListItemIcon>
            Valider et créer une intervention
          </MenuItem>
        )}
        
        {/* Option de modification - toujours visible si permissions */}
        {selectedServiceRequest && canModifyServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            Modifier
          </MenuItem>
        )}
        
        {/* Option de suppression - seulement si pas approuvée */}
        {selectedServiceRequest && canDeleteServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            Supprimer
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
              primary="Annuler la demande"
              secondary={`Temps restant: ${Math.round(getRemainingCancellationTime(selectedServiceRequest.approvedAt || selectedServiceRequest.createdAt))}h`}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>Confirmer la suppression</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2">
            Êtes-vous sûr de vouloir supprimer la demande de service "{selectedServiceRequest?.title}" ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small">Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de changement de statut */}
      <Dialog open={statusChangeDialogOpen} onClose={() => setStatusChangeDialogOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>Changer le statut</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="caption" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
            Changer le statut de la demande "{selectedRequestForStatusChange?.title}"
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Nouveau statut</InputLabel>
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
          <Button onClick={() => setStatusChangeDialogOpen(false)} size="small">Annuler</Button>
          <Button onClick={confirmStatusChange} variant="contained" size="small">
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
