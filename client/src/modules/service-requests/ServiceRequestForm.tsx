import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Home,
  LocationOn,
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Close,
  Save,
  Cancel,
  Person,
  Add,
  Description,
  Schedule,
  PriorityHigh,
  Category,
  Group,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { serviceRequestsApi, propertiesApi, usersApi, teamsApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { InterventionType, INTERVENTION_TYPE_OPTIONS, InterventionTypeUtils } from '../../types/interventionTypes';
import { REQUEST_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceRequestSchema } from '../../schemas';
import type { ServiceRequestFormValues } from '../../schemas';

// Types pour les demandes de service
export interface ServiceRequestFormData {
  title: string;
  description: string;
  propertyId: number;
  serviceType: string; // Changed from 'type' to 'serviceType'
  priority: string;
  estimatedDurationHours: number; // Changed from 'estimatedDuration' to 'estimatedDurationHours'
  desiredDate: string; // Changed from 'dueDate' to 'desiredDate'
  userId: number; // Changed from 'requestorId' to 'userId'
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
}

// Type pour les propriétés
interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  ownerId?: number; // Added ownerId
}

// Type pour les utilisateurs
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// Type pour les équipes
interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
}

interface ServiceRequestFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
  // Edit mode props
  serviceRequestId?: number;
  mode?: 'create' | 'edit';
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({ onClose, onSuccess, setLoading, loading, serviceRequestId, mode = 'create' }) => {
  const navigate = useNavigate();
  const { user, hasPermissionAsync,  isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();

  const isEditMode = mode === 'edit' || !!serviceRequestId;

  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingServiceRequest, setLoadingServiceRequest] = useState(false);
  const [canAssignForProperty, setCanAssignForProperty] = useState(false);
  const [approvedStatus, setApprovedStatus] = useState(false);

  // react-hook-form with Zod validation
  const { control, handleSubmit: rhfHandleSubmit, watch, setValue, reset } = useForm<ServiceRequestFormValues>({
    resolver: zodResolver(serviceRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      propertyId: 0,
      serviceType: 'CLEANING',
      priority: 'NORMAL',
      estimatedDurationHours: 1,
      desiredDate: '',
      userId: undefined,
      assignedToId: undefined,
      assignedToType: undefined,
      status: undefined,
    },
  });

  // Watch fields that are needed for conditional logic
  const watchedPropertyId = watch('propertyId');
  const watchedAssignedToType = watch('assignedToType');
  const watchedAssignedToId = watch('assignedToId');
  const watchedStatus = watch('status');

  // Charger les données de la demande de service en mode édition
  useEffect(() => {
    if (!isEditMode || !serviceRequestId) return;

    const loadServiceRequest = async () => {
      setLoadingServiceRequest(true);
      try {
        const serviceRequest = await serviceRequestsApi.getById(serviceRequestId);
        const sr = serviceRequest as any;

        // Check if APPROVED - prevent editing
        if (sr.status === 'APPROVED') {
          setApprovedStatus(true);
          setLoadingServiceRequest(false);
          return;
        }

        // Map API fields to form fields
        const desiredDateFormatted = sr.desiredDate
          ? new Date(sr.desiredDate).toISOString().slice(0, 16)
          : '';

        reset({
          title: sr.title || '',
          description: sr.description || '',
          propertyId: sr.propertyId || 0,
          serviceType: sr.serviceType || 'CLEANING',
          priority: sr.priority || 'NORMAL',
          estimatedDurationHours: sr.estimatedDurationHours || 1,
          desiredDate: desiredDateFormatted,
          userId: sr.userId || undefined,
          assignedToId: sr.assignedToId || undefined,
          assignedToType: sr.assignedToType || undefined,
          status: sr.status || 'PENDING',
        });

        // Check canAssign for the loaded property
        if (sr.propertyId) {
          try {
            const canAssignData = await apiClient.get<{ canAssign: boolean }>(`/properties/${sr.propertyId}/can-assign`);
            setCanAssignForProperty(canAssignData.canAssign || false);
          } catch (err) {
            // Silently fail
          }
        }
      } catch (err) {
        setError(t('serviceRequests.loadError'));
      } finally {
        setLoadingServiceRequest(false);
      }
    };

    loadServiceRequest();
  }, [isEditMode, serviceRequestId, reset, t]);

  // Vérifier si l'utilisateur peut assigner pour la propriété sélectionnée
  useEffect(() => {
    // Skip this effect during initial edit mode load (handled by loadServiceRequest)
    if (isEditMode && loadingServiceRequest) return;

    const checkCanAssign = async () => {
      if (!watchedPropertyId || watchedPropertyId === 0) {
        setCanAssignForProperty(false);
        return;
      }

      try {
        const data = await apiClient.get<{ canAssign: boolean }>(`/properties/${watchedPropertyId}/can-assign`);
        setCanAssignForProperty(data.canAssign || false);

        // Si l'utilisateur ne peut pas assigner, réinitialiser les valeurs d'assignation
        if (!data.canAssign) {
          setValue('assignedToType', undefined);
          setValue('assignedToId', undefined);
        }
      } catch (err) {
        setCanAssignForProperty(false);
      }
    };

    checkCanAssign();
  }, [watchedPropertyId, setValue, isEditMode, loadingServiceRequest]);

  // Réinitialiser les valeurs d'assignation pour les HOST (only in create mode)
  useEffect(() => {
    if (isEditMode) return;
    if (isHost()) {
      // Les HOST ne peuvent pas assigner, donc on réinitialise ces valeurs
      setValue('assignedToType', undefined);
      setValue('assignedToId', undefined);
    }
  }, [isHost, setValue, isEditMode]);

  // Charger les propriétés depuis l'API
  useEffect(() => {
    const loadProperties = async () => {
      setLoadingData(true);
      try {
        const data = await propertiesApi.getAll();
        const propertiesList = ((data as unknown as { content?: Property[] }).content || data) as unknown as Property[];
        setProperties(propertiesList);

        // Si c'est un HOST en mode création, définir automatiquement sa première propriété
        if (!isEditMode && isHost() && propertiesList.length > 0) {
          const hostProperty = propertiesList.find((prop: Property) =>
            prop.ownerId?.toString() === user?.id?.toString()
          );
          if (hostProperty) {
            setValue('propertyId', hostProperty.id);
          }
        }
      } catch (err) {
      } finally {
        setLoadingData(false);
      }
    };

    loadProperties();
  }, [isHost, user?.id, setValue, isEditMode]);

  // Charger la liste des utilisateurs depuis l'API
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await usersApi.getAll();
        const usersList = ((data as unknown as { content?: User[] }).content || data) as unknown as User[];
        setUsers(usersList);

        // Si c'est un HOST en mode création, définir automatiquement son ID comme demandeur
        if (!isEditMode && isHost() && user?.id) {
          const hostUser = usersList.find((u: User) => u.id.toString() === user.id.toString());
          if (hostUser) {
            setValue('userId', hostUser.id);
          }
        }
      } catch (err) {
      }
    };

    loadUsers();
  }, [isHost, user?.id, setValue, isEditMode]);

  // Charger la liste des équipes depuis l'API
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const data = await teamsApi.getAll();
        const teamsList = ((data as unknown as { content?: Team[] }).content || data) as unknown as Team[];
        setTeams(teamsList);
      } catch (err) {
      }
    };

    loadTeams();
  }, []);

  // Définir l'utilisateur par défaut selon le rôle (only in create mode)
  useEffect(() => {
    if (isEditMode) return;
    if (isHost() && user?.id) {
      // Pour un HOST, essayer de trouver son ID dans la base
      const hostUser = users.find(u => u.email === user.email);
      if (hostUser) {
        setValue('userId', hostUser.id);
      }
    } else if (!isAdmin() && !isManager()) {
      // Pour les autres rôles non-admin, sélectionner automatiquement l'utilisateur connecté
      const currentUser = users.find(u => u.email === user?.email);
      if (currentUser) {
        setValue('userId', currentUser.id);
      }
    }
  }, [users, user, isHost, isAdmin, isManager, setValue, isEditMode]);

  // Vérifier les permissions silencieusement
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const permission = isEditMode ? 'service-requests:edit' : 'service-requests:create';
      const hasPerms = await hasPermissionAsync(permission);
      setHasPermission(hasPerms);
    };

    checkPermissions();
  }, [hasPermissionAsync, isEditMode]);

  // Si l'utilisateur n'a pas les permissions, ne rien afficher
  if (!hasPermission) {
    return null;
  }

  // En mode édition, si la demande est approuvée, empêcher l'édition
  if (isEditMode && approvedStatus) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('serviceRequests.approvedCannotEdit')}
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate(`/service-requests/${serviceRequestId}`)}
          startIcon={<ArrowBack />}
        >
          {t('common.back')}
        </Button>
      </Box>
    );
  }

  if (loadingData || loadingServiceRequest) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const onSubmit = async (formData: ServiceRequestFormValues) => {
    if (!formData.propertyId || !formData.userId) {
      setError(t('serviceRequests.errors.selectPropertyRequestor'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Transformer la date en format ISO pour le backend
      const desiredDate = formData.desiredDate ? new Date(formData.desiredDate).toISOString() : null;

      // Préparer les données pour le backend
      const backendData: Record<string, string | number | boolean | null> = {
        title: formData.title,
        description: formData.description,
        propertyId: formData.propertyId,
        serviceType: formData.serviceType,
        priority: formData.priority,
        estimatedDurationHours: formData.estimatedDurationHours,
        desiredDate: desiredDate,
        userId: formData.userId ?? null,
      };

      if (isEditMode) {
        // En mode édition, inclure le statut
        backendData.status = formData.status || 'PENDING';
      } else {
        // En mode création, statut par défaut
        backendData.status = 'PENDING';
      }

      // Seuls les utilisateurs autorisés peuvent définir l'assignation
      if (canAssignForProperty) {
        backendData.assignedToId = formData.assignedToId || null;
        backendData.assignedToType = formData.assignedToType || null;
      } else {
        if (!isEditMode) {
          // Pour les utilisateurs non autorisés en création, ne pas envoyer d'assignation
          backendData.assignedToId = null;
          backendData.assignedToType = null;
        }
        // En mode édition, ne pas modifier l'assignation si l'utilisateur n'y a pas droit
      }

      if (isEditMode && serviceRequestId) {
        await serviceRequestsApi.update(serviceRequestId, backendData);

        setSuccess(true);
        // Utiliser onSuccess si fourni, sinon rediriger
        if (onSuccess) {
          onSuccess();
        } else {
          setTimeout(() => {
            navigate(`/service-requests/${serviceRequestId}`);
          }, 1500);
        }
      } else {
        await apiClient.post('/service-requests', backendData);

        // Utiliser onSuccess si fourni, sinon rediriger
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/service-requests?success=true');
        }
      }
    } catch (err: any) {
      const message = err?.message || (isEditMode ? t('serviceRequests.updateError') : t('serviceRequests.errors.createError'));
      const errorPrefix = isEditMode ? t('serviceRequests.updateErrorDetails') : t('serviceRequests.errors.createErrorDetails');
      setError(errorPrefix + ': ' + message);
    } finally {
      setSaving(false);
    }
  };

  // Constantes pour les enums
  const serviceTypes = INTERVENTION_TYPE_OPTIONS.map(option => ({
    value: option.value,
    label: option.label
  }));

  const priorities = [
    { value: 'LOW', label: t('serviceRequests.priorities.low') },
    { value: 'NORMAL', label: t('serviceRequests.priorities.normal') },
    { value: 'HIGH', label: t('serviceRequests.priorities.high') },
    { value: 'CRITICAL', label: t('serviceRequests.priorities.critical') },
  ];

  const statuses = REQUEST_STATUS_OPTIONS.map(option => ({
    value: option.value,
    label: option.label
  }));

  const durations = [
    { value: 0.5, label: t('serviceRequests.durations.30min') },
    { value: 1, label: t('serviceRequests.durations.1h') },
    { value: 1.5, label: t('serviceRequests.durations.1h30') },
    { value: 2, label: t('serviceRequests.durations.2h') },
    { value: 3, label: t('serviceRequests.durations.3h') },
    { value: 4, label: t('serviceRequests.durations.4h') },
    { value: 6, label: t('serviceRequests.durations.6h') },
    { value: 8, label: t('serviceRequests.durations.8h') },
  ];

  // Filtrer les utilisateurs par rôle approprié pour l'assignation
  const getAssignableUsers = () => {
    return users.filter(user =>
      ['housekeeper', 'technician', 'supervisor', 'manager'].includes(user.role.toLowerCase())
    );
  };

  // Obtenir le label du type d'intervention
  const getInterventionTypeLabel = (type: string) => {
    const interventionTypes: Record<string, string> = {
      cleaning: t('serviceRequests.interventionTypes.cleaning'),
      maintenance: t('serviceRequests.interventionTypes.maintenance'),
      repair: t('serviceRequests.interventionTypes.repair'),
      inspection: t('serviceRequests.interventionTypes.inspection'),
      mixed: t('serviceRequests.interventionTypes.mixed'),
    };
    return interventionTypes[type.toLowerCase()] || type;
  };

  return (
    <Box>
      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {isEditMode && success && (
        <Alert severity="success" sx={{ mb: 2, py: 1 }}>
          {t('serviceRequests.updateRequestSuccess')}
        </Alert>
      )}

      {/* Formulaire */}
      <Card sx={{ mt: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <form onSubmit={rhfHandleSubmit(onSubmit)}>
            {/* Informations de base */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.basicInfo')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={isEditMode ? 6 : 8}>
                <Controller
                  name="title"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={`${t('serviceRequests.fields.title')} *`}
                      required
                      placeholder={t('serviceRequests.fields.titlePlaceholder')}
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={isEditMode ? 3 : 4}>
                <Controller
                  name="serviceType"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('serviceRequests.fields.serviceType')} *</InputLabel>
                      <Select
                        {...field}
                        label={`${t('serviceRequests.fields.serviceType')} *`}
                        size="small"
                      >
                        {serviceTypes.map((type) => {
                          const typeOption = INTERVENTION_TYPE_OPTIONS.find(option => option.value === type.value);
                          const IconComponent = typeOption?.icon;

                          return (
                            <MenuItem key={type.value} value={type.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                {IconComponent && <IconComponent sx={{ fontSize: 18 }} />}
                                <Typography variant="body2">{type.label}</Typography>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Statut - seulement en mode édition */}
              {isEditMode && (
                <Grid item xs={12} md={3}>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth required>
                        <InputLabel>{t('common.status')} *</InputLabel>
                        <Select
                          value={field.value || 'PENDING'}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          label={`${t('common.status')} *`}
                          size="small"
                        >
                          {statuses.map((status) => (
                            <MenuItem key={status.value} value={status.value}>
                              {status.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              )}
            </Grid>

            {/* Description */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.description')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label={`${t('serviceRequests.fields.detailedDescription')} *`}
                      required
                      placeholder={t('serviceRequests.fields.descriptionPlaceholder')}
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>

            {/* Propriété */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.property')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <Controller
                  name="propertyId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('serviceRequests.fields.property')} *</InputLabel>
                      <Select
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        onBlur={field.onBlur}
                        label={`${t('serviceRequests.fields.property')} *`}
                        size="small"
                      >
                        {properties.map((property) => (
                          <MenuItem key={property.id} value={property.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Home sx={{ fontSize: 18 }} />
                              <Typography variant="body2">{property.name} - {property.address}, {property.city}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>

            {/* Priorité et durée */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.priorityPlanning')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('serviceRequests.fields.priority')} *</InputLabel>
                      <Select
                        {...field}
                        label={`${t('serviceRequests.fields.priority')} *`}
                        size="small"
                      >
                        {priorities.map((priority) => (
                          <MenuItem key={priority.value} value={priority.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <PriorityHigh sx={{ fontSize: 18 }} />
                              <Typography variant="body2">{priority.label}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="estimatedDurationHours"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('serviceRequests.fields.estimatedDuration')} *</InputLabel>
                      <Select
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        onBlur={field.onBlur}
                        label={`${t('serviceRequests.fields.estimatedDuration')} *`}
                        size="small"
                      >
                        {durations.map((duration) => (
                          <MenuItem key={duration.value} value={duration.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Schedule sx={{ fontSize: 18 }} />
                              <Typography variant="body2">{duration.label}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="desiredDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={`${t('serviceRequests.fields.dueDate')} *`}
                      type="datetime-local"
                      required
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>

            {/* Demandeur et assignation */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.requestorAssignment')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              {/* Demandeur */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="userId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('serviceRequests.fields.requestor')} *</InputLabel>
                      <Select
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        onBlur={field.onBlur}
                        label={`${t('serviceRequests.fields.requestor')} *`}
                        disabled={!isAdmin() && !isManager()} // Seuls les admin/manager peuvent changer le demandeur
                        size="small"
                      >
                        {users.map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Person sx={{ fontSize: 18 }} />
                              <Typography variant="body2">{user.firstName} {user.lastName} ({user.role}) - {user.email}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      {!isAdmin() && !isManager() && (
                        <FormHelperText sx={{ fontSize: '0.7rem' }}>
                          {t('serviceRequests.fields.requestorHelper')}
                        </FormHelperText>
                      )}
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Type d'assignation - seulement pour ADMIN, MANAGER ou utilisateur qui gère le portefeuille */}
              {canAssignForProperty && (
                <Grid item xs={12} md={6}>
                  <Controller
                    name="assignedToType"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>{t('serviceRequests.fields.assignmentType')}</InputLabel>
                        <Select
                          value={field.value || ''}
                          onChange={(e) => {
                            const val = e.target.value as 'user' | 'team' | '';
                            field.onChange(val || undefined);
                            setValue('assignedToId', undefined);
                          }}
                          onBlur={field.onBlur}
                          label={t('serviceRequests.fields.assignmentType')}
                          size="small"
                        >
                          <MenuItem value="">
                            <em>{t('serviceRequests.fields.noAssignment')}</em>
                          </MenuItem>
                          <MenuItem value="user">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Person sx={{ fontSize: 18 }} />
                              <Typography variant="body2">{t('serviceRequests.fields.individualUser')}</Typography>
                            </Box>
                          </MenuItem>
                          <MenuItem value="team">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Group sx={{ fontSize: 18 }} />
                              <Typography variant="body2">{t('serviceRequests.fields.team')}</Typography>
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              )}
            </Grid>

            {/* Assignation spécifique - seulement pour ADMIN, MANAGER ou utilisateur qui gère le portefeuille */}
            {canAssignForProperty && watchedAssignedToType && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <Controller
                    name="assignedToId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>
                          {watchedAssignedToType === 'user' ? t('serviceRequests.fields.assignedToUser') : t('serviceRequests.fields.assignedToTeam')}
                        </InputLabel>
                        <Select
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          onBlur={field.onBlur}
                          label={watchedAssignedToType === 'user' ? t('serviceRequests.fields.assignedToUser') : t('serviceRequests.fields.assignedToTeam')}
                          size="small"
                        >
                          <MenuItem value="">
                            <em>{t('serviceRequests.fields.select')}</em>
                          </MenuItem>
                          {watchedAssignedToType === 'user' ? (
                            getAssignableUsers().map((user) => (
                              <MenuItem key={user.id} value={user.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <Person sx={{ fontSize: 18 }} />
                                  <Typography variant="body2">{user.firstName} {user.lastName} ({user.role}) - {user.email}</Typography>
                                </Box>
                              </MenuItem>
                            ))
                          ) : (
                            teams.map((team) => (
                              <MenuItem key={team.id} value={team.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <Group sx={{ fontSize: 18 }} />
                                  <Box>
                                    <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                                      {team.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      {team.memberCount} {t('serviceRequests.members')} • {getInterventionTypeLabel(team.interventionType)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                            ))
                          )}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
              </Grid>
            )}

          </form>

          {/* Bouton de soumission caché pour le PageHeader */}
          <Button
            type="submit"
            sx={{ display: 'none' }}
            data-submit-service-request
          >
            Soumettre
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ServiceRequestForm;
