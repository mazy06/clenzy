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
import { serviceRequestsApi } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

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
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceRequest, setServiceRequest] = useState<ServiceRequestDetailsData | null>(null);
  
  // Vérifier les permissions pour l'édition - DOIT être déclaré avant tout retour conditionnel
  const [canEdit, setCanEdit] = useState(false);

  // Charger les données de la demande de service
  useEffect(() => {
    const loadServiceRequest = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const data: any = await serviceRequestsApi.getById(parseInt(id));
        // Convertir les données du backend vers le format frontend
        const convertedServiceRequest: ServiceRequestDetailsData = {
          id: data.id.toString(),
          title: data.title,
          description: data.description,
          type: (data.serviceType || data.type)?.toString().toLowerCase() || 'other',
          status: data.status?.toString().toLowerCase() || 'pending',
          priority: data.priority?.toString().toLowerCase() || 'medium',
          propertyId: data.propertyId,
          propertyName: data.property?.name || t('serviceRequests.unknownProperty'),
          propertyAddress: data.property?.address || '',
          propertyCity: data.property?.city || '',
          propertyPostalCode: data.property?.postalCode,
          propertyCountry: data.property?.country,
          requestorId: data.userId || data.requestorId,
          requestorName: data.user ? `${data.user.firstName} ${data.user.lastName}` : (data.requestor ? `${data.requestor.firstName} ${data.requestor.lastName}` : t('serviceRequests.unknownRequestor')),
          requestorEmail: data.user?.email || data.requestor?.email,
          assignedToId: data.assignedToId,
          assignedToName: data.assignedToUser
            ? `${data.assignedToUser.firstName} ${data.assignedToUser.lastName}`
            : (data.assignedToTeam ? data.assignedToTeam.name : undefined),
          assignedToEmail: data.assignedToUser?.email,
          assignedToType: data.assignedToType || (data.assignedToUser ? 'user' : (data.assignedToTeam ? 'team' : undefined)),
          estimatedDuration: data.estimatedDurationHours || data.estimatedDuration || 1,
          dueDate: data.desiredDate || data.dueDate || '',
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt,
          completedAt: data.completedAt,
        };

        setServiceRequest(convertedServiceRequest);
      } catch (err) {
        setError(t('serviceRequests.loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadServiceRequest();
  }, [id]);

  // Vérifier les permissions pour l'édition
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('service-requests:edit');
      setCanEdit(canEditPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

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

  const getStatusColor = (status: string): ChipColor => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'pending':
        return 'warning';
      case 'approved':
        return 'info';
      case 'in_progress':
        return 'info';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'default';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string): ChipColor => {
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
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'pending':
        return t('serviceRequests.statuses.pending');
      case 'approved':
        return t('serviceRequests.statuses.approved');
      case 'in_progress':
        return t('serviceRequests.statuses.inProgress');
      case 'completed':
        return t('serviceRequests.statuses.completed');
      case 'cancelled':
        return t('serviceRequests.statuses.cancelled');
      case 'rejected':
        return t('serviceRequests.statuses.rejected');
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
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ py: 1 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!serviceRequest) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ py: 1 }}>
          Demande de service non trouvée
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header avec bouton retour et bouton modifier */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate('/service-requests')} 
            sx={{ mr: 1.5 }}
            size="small"
          >
            <ArrowBack sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography variant="h6" fontWeight={600}>
            {t('serviceRequests.detailsTitle')}
          </Typography>
        </Box>
        
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => navigate(`/service-requests/${id}/edit`)}
            size="small"
          >
            {t('serviceRequests.modify')}
          </Button>
        )}
      </Box>

      {/* Carte principale avec résumé */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          {/* En-tête de la demande */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ fontSize: 20 }}>{getTypeIcon(serviceRequest.type)}</Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '1rem' }}>
                {serviceRequest.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Chip
                label={getStatusLabel(serviceRequest.status)}
                color={getStatusColor(serviceRequest.status)}
                size="small"
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
              <Chip
                label={getPriorityLabel(serviceRequest.priority)}
                color={getPriorityColor(serviceRequest.priority)}
                size="small"
                icon={<PriorityHigh sx={{ fontSize: 14 }} />}
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
            </Box>
          </Box>

          {/* Description */}
          <Typography variant="body2" sx={{ mb: 2, fontSize: '0.85rem' }}>
            {serviceRequest.description}
          </Typography>

          {/* Propriété */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
            <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
              {serviceRequest.propertyName} - {serviceRequest.propertyAddress}, {serviceRequest.propertyCity}
              {serviceRequest.propertyPostalCode && `, ${serviceRequest.propertyPostalCode}`}
              {serviceRequest.propertyCountry && `, ${serviceRequest.propertyCountry}`}
            </Typography>
          </Box>

          {/* Métriques principales */}
          <Grid container spacing={2} sx={{ mb: 0 }}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Category sx={{ fontSize: 18, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {getTypeLabel(serviceRequest.type)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('common.type')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <AccessTime sx={{ fontSize: 18, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {formatDuration(serviceRequest.estimatedDuration)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('serviceRequests.estimatedDurationLabel')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <CalendarToday sx={{ fontSize: 18, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {formatDate(serviceRequest.dueDate)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('serviceRequests.dueDateShort')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Schedule sx={{ fontSize: 18, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {formatDate(serviceRequest.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('serviceRequests.createdDateShort')}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Détails complets */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {/* Informations de base */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                {t('serviceRequests.sections.basicInfo')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.titleLabel')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {serviceRequest.title}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.fields.serviceType')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {getTypeLabel(serviceRequest.type)}
              </Typography>
            </Grid>

            {/* Description complète */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.fields.detailedDescription')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {serviceRequest.description}
              </Typography>
            </Grid>

            {/* Statut et priorité */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  {t('serviceRequests.fields.status')}
                </Typography>
                <Chip
                  label={getStatusLabel(serviceRequest.status)}
                  color={getStatusColor(serviceRequest.status)}
                  size="small"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  {t('serviceRequests.fields.priority')}
                </Typography>
                <Chip
                  label={`${getPriorityLabel(serviceRequest.priority)}`}
                  color={getPriorityColor(serviceRequest.priority)}
                  size="small"
                  icon={<PriorityHigh sx={{ fontSize: 14, mr: 0.5 }} />}
                  sx={{ height: 22, fontSize: '0.7rem', '& .MuiChip-icon': { marginLeft: '4px' } }}
                />
              </Box>
            </Grid>

            {/* Propriété */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                Propriété concernée
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.propertyNameLabel')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {serviceRequest.propertyName}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.fullAddressLabel')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {serviceRequest.propertyAddress}, {serviceRequest.propertyCity}
                {serviceRequest.propertyPostalCode && `, ${serviceRequest.propertyPostalCode}`}
                {serviceRequest.propertyCountry && `, ${serviceRequest.propertyCountry}`}
              </Typography>
            </Grid>

            {/* Planification */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                {t('serviceRequests.planning')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.estimatedDurationLabel')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {formatDuration(serviceRequest.estimatedDuration)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.dueDateLabel')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {formatDate(serviceRequest.dueDate)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.createdDateLabel')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                {formatDate(serviceRequest.createdAt)}
              </Typography>
            </Grid>

            {/* Personnes impliquées */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                {t('serviceRequests.peopleInvolved')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.fields.requestor')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  {serviceRequest.requestorName}
                  {serviceRequest.requestorEmail && ` (${serviceRequest.requestorEmail})`}
                </Typography>
              </Box>
            </Grid>

            {/* Assignation */}
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                {t('serviceRequests.assignedTo')}
              </Typography>
              {serviceRequest.assignedToName ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                  {serviceRequest.assignedToType === 'team' ? (
                    <Group sx={{ fontSize: 16, color: 'text.secondary' }} />
                  ) : (
                    <Assignment sx={{ fontSize: 16, color: 'text.secondary' }} />
                  )}
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    {serviceRequest.assignedToName}
                    {serviceRequest.assignedToEmail && serviceRequest.assignedToType === 'user' && ` (${serviceRequest.assignedToEmail})`}
                    {serviceRequest.assignedToType === 'team' && (
                      <Chip 
                        label="Équipe" 
                        size="small" 
                        variant="outlined" 
                        sx={{ ml: 0.5, height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.85rem' }}>
                  {t('serviceRequests.fields.noAssignment')}
                </Typography>
              )}
            </Grid>

            {/* Métadonnées */}
            {serviceRequest.updatedAt && (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                    {t('serviceRequests.systemInfo')}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                    {t('serviceRequests.updatedDateShort')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                    {formatDate(serviceRequest.updatedAt)}
                  </Typography>
                </Grid>
              </>
            )}

            {serviceRequest.completedAt && (
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {t('serviceRequests.completedDateShort')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
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
