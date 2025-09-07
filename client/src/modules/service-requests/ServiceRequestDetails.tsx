import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Home,
  LocationOn,
  Person,
  Category,
  PriorityHigh,
  Schedule,
  CalendarToday,
  AccessTime,
  Assignment,
  CleaningServices,
  Build,
  Group,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

// Interface pour les demandes de service détaillées
export interface ServiceRequestDetailsData {
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
  propertyPostalCode?: string;
  propertyCountry?: string;
  requestorId: number;
  requestorName: string;
  requestorEmail?: string;
  assignedToId?: number;
  assignedToName?: string;
  assignedToEmail?: string;
  assignedToType?: 'user' | 'team';
  estimatedDuration: number;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

const ServiceRequestDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceRequest, setServiceRequest] = useState<ServiceRequestDetailsData | null>(null);

  // Charger les données de la demande de service
  useEffect(() => {
    const loadServiceRequest = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('🔍 ServiceRequestDetails - Demande de service chargée:', data);
          
          // Convertir les données du backend vers le format frontend
          const convertedServiceRequest: ServiceRequestDetailsData = {
            id: data.id.toString(),
            title: data.title,
            description: data.description,
            type: data.type?.toLowerCase() || 'other',
            status: data.status?.toLowerCase() || 'pending',
            priority: data.priority?.toLowerCase() || 'medium',
            propertyId: data.propertyId,
            propertyName: data.property?.name || 'Propriété inconnue',
            propertyAddress: data.property?.address || '',
            propertyCity: data.property?.city || '',
            propertyPostalCode: data.property?.postalCode,
            propertyCountry: data.property?.country,
            requestorId: data.requestorId,
            requestorName: data.requestor ? `${data.requestor.firstName} ${data.requestor.lastName}` : 'Demandeur inconnu',
            requestorEmail: data.requestor?.email,
            assignedToId: data.assignedToId,
            assignedToName: data.assignedTo ? `${data.assignedTo.firstName} ${data.assignedTo.lastName}` : undefined,
            assignedToEmail: data.assignedTo?.email,
            assignedToType: data.assignedToType || (data.assignedTo ? 'user' : undefined),
            estimatedDuration: data.estimatedDuration || 1,
            dueDate: data.dueDate,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            completedAt: data.completedAt,
          };
          
          setServiceRequest(convertedServiceRequest);
        } else {
          setError('Erreur lors du chargement de la demande de service');
        }
      } catch (err) {
        console.error('🔍 ServiceRequestDetails - Erreur chargement:', err);
        setError('Erreur lors du chargement de la demande de service');
      } finally {
        setLoading(false);
      }
    };

    loadServiceRequest();
  }, [id]);

  // Fonctions utilitaires
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cleaning':
        return <CleaningServices />;
      case 'maintenance':
        return <Build />;
      case 'repair':
        return <Build />;
      case 'inspection':
        return <Assignment />;
      default:
        return <Category />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'default';
      case 'medium':
        return 'info';
      case 'high':
        return 'warning';
      case 'urgent':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'in_progress':
        return 'En cours';
      case 'completed':
        return 'Terminé';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'Faible';
      case 'medium':
        return 'Moyenne';
      case 'high':
        return 'Élevée';
      case 'urgent':
        return 'Urgente';
      default:
        return priority;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'cleaning':
        return 'Nettoyage';
      case 'maintenance':
        return 'Maintenance';
      case 'repair':
        return 'Réparation';
      case 'inspection':
        return 'Inspection';
      case 'other':
        return 'Autre';
      default:
        return type;
    }
  };

  const formatDuration = (duration: number): string => {
    if (duration === 0.5) return '30 min';
    if (duration === 1) return '1h';
    if (duration === 1.5) return '1h30';
    return `${duration}h`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  if (!serviceRequest) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Demande de service non trouvée
        </Alert>
      </Box>
    );
  }

  // Vérifier les permissions pour l'édition
  const [canEdit, setCanEdit] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('service-requests:edit');
      setCanEdit(canEditPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header avec bouton retour et bouton modifier */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate('/service-requests')} 
            sx={{ mr: 2 }}
            size="large"
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight={700}>
            Détails de la demande de service
          </Typography>
        </Box>
        
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => navigate(`/service-requests/${id}/edit`)}
          >
            Modifier
          </Button>
        )}
      </Box>

      {/* Carte principale avec résumé */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          {/* En-tête de la demande */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getTypeIcon(serviceRequest.type)}
              <Typography variant="h5" fontWeight={600}>
                {serviceRequest.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={getStatusLabel(serviceRequest.status)}
                color={getStatusColor(serviceRequest.status) as any}
                size="medium"
              />
              <Chip
                label={getPriorityLabel(serviceRequest.priority)}
                color={getPriorityColor(serviceRequest.priority) as any}
                size="medium"
                icon={<PriorityHigh />}
              />
            </Box>
          </Box>

          {/* Description */}
          <Typography variant="body1" sx={{ mb: 3 }}>
            {serviceRequest.description}
          </Typography>

          {/* Propriété */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <LocationOn sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body1" color="text.secondary">
              {serviceRequest.propertyName} - {serviceRequest.propertyAddress}, {serviceRequest.propertyCity}
              {serviceRequest.propertyPostalCode && `, ${serviceRequest.propertyPostalCode}`}
              {serviceRequest.propertyCountry && `, ${serviceRequest.propertyCountry}`}
            </Typography>
          </Box>

          {/* Métriques principales */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Category sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {getTypeLabel(serviceRequest.type)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <AccessTime sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {formatDuration(serviceRequest.estimatedDuration)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Durée estimée
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <CalendarToday sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {formatDate(serviceRequest.dueDate)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Échéance
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Schedule sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {formatDate(serviceRequest.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Créé le
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Détails complets */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={4}>
            {/* Informations de base */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Informations de base
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Titre
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {serviceRequest.title}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Type de service
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {getTypeLabel(serviceRequest.type)}
              </Typography>
            </Grid>

            {/* Description complète */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Description détaillée
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {serviceRequest.description}
              </Typography>
            </Grid>

            {/* Statut et priorité */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Statut
              </Typography>
              <Chip
                label={getStatusLabel(serviceRequest.status)}
                color={getStatusColor(serviceRequest.status) as any}
                sx={{ mb: 2 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Priorité
              </Typography>
              <Chip
                label={getPriorityLabel(serviceRequest.priority)}
                color={getPriorityColor(serviceRequest.priority) as any}
                sx={{ mb: 2 }}
                icon={<PriorityHigh />}
              />
            </Grid>

            {/* Propriété */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Propriété concernée
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Nom de la propriété
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {serviceRequest.propertyName}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Adresse complète
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {serviceRequest.propertyAddress}, {serviceRequest.propertyCity}
                {serviceRequest.propertyPostalCode && `, ${serviceRequest.propertyPostalCode}`}
                {serviceRequest.propertyCountry && `, ${serviceRequest.propertyCountry}`}
              </Typography>
            </Grid>

            {/* Planification */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Planification
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Durée estimée
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDuration(serviceRequest.estimatedDuration)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Date d'échéance
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(serviceRequest.dueDate)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Date de création
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(serviceRequest.createdAt)}
              </Typography>
            </Grid>

            {/* Personnes impliquées */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Personnes impliquées
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Demandeur
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Person sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body1">
                  {serviceRequest.requestorName}
                  {serviceRequest.requestorEmail && ` (${serviceRequest.requestorEmail})`}
                </Typography>
              </Box>
            </Grid>

            {/* Assignation */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Assigné à
              </Typography>
              {serviceRequest.assignedToName ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  {serviceRequest.assignedToType === 'team' ? (
                    <Group sx={{ fontSize: 18, color: 'text.secondary' }} />
                  ) : (
                    <Assignment sx={{ fontSize: 18, color: 'text.secondary' }} />
                  )}
                  <Typography variant="body1">
                    {serviceRequest.assignedToName}
                    {serviceRequest.assignedToEmail && serviceRequest.assignedToType === 'user' && ` (${serviceRequest.assignedToEmail})`}
                    {serviceRequest.assignedToType === 'team' && (
                      <Chip 
                        label="Équipe" 
                        size="small" 
                        variant="outlined" 
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Aucune assignation
                </Typography>
              )}
            </Grid>

            {/* Métadonnées */}
            {serviceRequest.updatedAt && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                    Informations système
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Modifié le
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatDate(serviceRequest.updatedAt)}
                  </Typography>
                </Grid>
              </>
            )}

            {serviceRequest.completedAt && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Terminé le
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {formatDate(serviceRequest.completedAt)}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ServiceRequestDetails;
