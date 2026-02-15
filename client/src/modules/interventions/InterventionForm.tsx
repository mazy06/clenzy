import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  FormHelperText,
  IconButton
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { interventionSchema, type InterventionFormValues } from '../../schemas';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, propertiesApi, usersApi, teamsApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { InterventionType, INTERVENTION_TYPE_OPTIONS, InterventionTypeUtils } from '../../types/interventionTypes';
import { InterventionStatus, INTERVENTION_STATUS_OPTIONS, Priority, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';

// Exported for backward compatibility
export interface InterventionFormData {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  requestorId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  estimatedCost?: number;
  notes: string;
  photos: string;
  progressPercentage: number;
}

interface PropertyWithDefaults {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  defaultCheckOutTime?: string;
  defaultCheckInTime?: string;
}

interface Property extends PropertyWithDefaults {}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
}

const interventionTypes = INTERVENTION_TYPE_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

// Utilisation des enums partages
const statuses = INTERVENTION_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

const priorities = PRIORITY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

interface InterventionFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
  // Edit mode props
  interventionId?: number;  // If provided, form is in edit mode
  mode?: 'create' | 'edit'; // Default: 'create'
}

const InterventionForm: React.FC<InterventionFormProps> = ({ onClose, onSuccess, setLoading, loading, interventionId, mode }) => {
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Detect edit mode
  const isEditMode = mode === 'edit' || !!interventionId;

  // Verifier la permission selon le mode
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      if (isEditMode) {
        const canEdit = await hasPermissionAsync('interventions:edit');
        setHasPermission(canEdit);
      } else {
        const canCreate = isAdmin() || isManager();
        setHasPermission(canCreate);
      }
    };

    checkPermissions();
  }, [isAdmin, isManager, isEditMode, hasPermissionAsync]);

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  // Separate date/time state for scheduled date
  const [scheduledDatePart, setScheduledDatePart] = useState('');
  const [scheduledTimePart, setScheduledTimePart] = useState('11:00');

  const { control, handleSubmit: rhfHandleSubmit, watch, setValue, reset } = useForm<InterventionFormValues>({
    resolver: zodResolver(interventionSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      type: InterventionType.CLEANING,
      status: InterventionStatus.PENDING,
      priority: Priority.NORMAL,
      propertyId: 0,
      requestorId: 0,
      assignedToId: undefined,
      assignedToType: undefined,
      scheduledDate: '',
      estimatedDurationHours: 1,
      estimatedCost: undefined,
      notes: '',
      photos: '',
      progressPercentage: 0
    }
  });

  const watchedAssignedToType = watch('assignedToType');
  const watchedPropertyId = watch('propertyId');

  // Sync separate date/time → scheduledDate hidden field
  useEffect(() => {
    if (scheduledDatePart && scheduledTimePart) {
      setValue('scheduledDate', `${scheduledDatePart}T${scheduledTimePart}`);
    } else if (scheduledDatePart) {
      setValue('scheduledDate', `${scheduledDatePart}T11:00`);
    }
  }, [scheduledDatePart, scheduledTimePart, setValue]);

  // When property changes, set default time to property's checkout time
  useEffect(() => {
    if (!watchedPropertyId || watchedPropertyId === 0) return;
    const selectedProperty = properties.find(p => p.id === watchedPropertyId);
    if (selectedProperty?.defaultCheckOutTime && !isEditMode) {
      setScheduledTimePart(selectedProperty.defaultCheckOutTime);
    }
  }, [watchedPropertyId, properties, isEditMode]);

  // Definir l'utilisateur par defaut selon le role
  useEffect(() => {
    if (isHost() && user?.id) {
      // Pour un HOST, essayer de trouver son ID dans la base
      const hostUser = users.find(u => u.email === user.email);
      if (hostUser) {
        setValue('requestorId', hostUser.id);
      }
    } else if (!isAdmin() && !isManager()) {
      // Pour les autres roles non-admin, selectionner automatiquement l'utilisateur connecte
      const currentUser = users.find(u => u.email === user?.email);
      if (currentUser) {
        setValue('requestorId', currentUser.id);
      }
    }
  }, [users, user, isHost, isAdmin, isManager, setValue]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Charger les proprietes, utilisateurs et equipes en parallele
        // En mode edit, charger aussi les donnees de l'intervention
        const [propertiesData, usersData, teamsData] = await Promise.all([
          propertiesApi.getAll().catch(() => []),
          usersApi.getAll().catch(() => []),
          teamsApi.getAll().catch(() => [])
        ]);

        // Charger l'intervention separement en mode edit
        let interventionData: any = null;
        if (isEditMode && interventionId) {
          interventionData = await interventionsApi.getById(interventionId);
        }

        const propertiesList = (propertiesData as any)?.content || propertiesData;
        setProperties(propertiesList);

        const usersList = (usersData as any)?.content || usersData;
        setUsers(usersList);

        const teamsList = (teamsData as any)?.content || teamsData;
        setTeams(teamsList);

        // In edit mode, populate the form with existing intervention data
        if (isEditMode && interventionData) {
          const isoDate = interventionData.scheduledDate
            ? new Date(interventionData.scheduledDate).toISOString().slice(0, 16)
            : '';
          // Split scheduledDate into date and time parts
          if (isoDate) {
            const [datePart, timePart] = isoDate.split('T');
            setScheduledDatePart(datePart);
            setScheduledTimePart(timePart || '11:00');
          }
          reset({
            title: interventionData.title || '',
            description: interventionData.description || '',
            type: interventionData.type || InterventionType.CLEANING,
            status: interventionData.status || InterventionStatus.PENDING,
            priority: interventionData.priority || Priority.NORMAL,
            propertyId: interventionData.propertyId || 0,
            requestorId: interventionData.requestorId || 0,
            assignedToId: interventionData.assignedToId || undefined,
            assignedToType: interventionData.assignedToType || undefined,
            scheduledDate: isoDate,
            estimatedDurationHours: interventionData.estimatedDurationHours || 1,
            estimatedCost: interventionData.estimatedCost ?? undefined,
            notes: interventionData.notes || '',
            photos: interventionData.photosUrl || '',
            progressPercentage: interventionData.progressPercentage || 0
          });
        }

      } catch (err) {
        setError(isEditMode ? 'Erreur lors du chargement de l\'intervention' : 'Erreur lors du chargement des donnees');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isEditMode, interventionId, reset]);

  // Si l'utilisateur n'a pas la permission, afficher un message ou ne rien afficher
  // ATTENTION : Cette verification doit etre APRES tous les hooks !
  if (!hasPermission) {
    if (isEditMode) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            <Typography variant="h6" gutterBottom>
              {t('common.accessDenied') || 'Acces non autorise'}
            </Typography>
            <Typography variant="body1">
              {t('interventions.errors.noEditPermission') || 'Vous n\'avez pas les permissions necessaires pour modifier des interventions.'}
            </Typography>
          </Alert>
        </Box>
      );
    }
    return null;
  }

  const onSubmit = async (formData: InterventionFormValues) => {
    if (!isEditMode && (!formData.propertyId || !formData.requestorId)) {
      setError(t('interventions.errors.selectPropertyRequestor'));
      return;
    }

    if (setLoading) {
      setLoading(true);
    } else {
      setSaving(true);
    }
    setError(null);

    try {
      if (isEditMode && interventionId) {
        // ── Edit mode: update the existing intervention ──
        await interventionsApi.update(interventionId, formData as any);

        if (onSuccess) {
          onSuccess();
        } else {
          navigate(`/interventions/${interventionId}`);
        }
      } else {
        // ── Create mode: create a new intervention ──
        const savedIntervention = await interventionsApi.create(formData as any);

        // Si un cout estime est defini ET que ce n'est pas un HOST, creer une session de paiement
        // Les HOST ne paient pas directement, ils attendent la validation du manager
        if (!isHost() && formData.estimatedCost && formData.estimatedCost > 0) {
          try {
            const paymentData = await apiClient.post<{ url: string }>('/payments/create-session', {
              interventionId: savedIntervention.id,
              amount: formData.estimatedCost
            });

            // Rediriger vers Stripe Checkout
            window.location.href = paymentData.url;
            return; // Ne pas continuer, la redirection va se faire
          } catch (paymentErr: any) {
            setError(paymentErr.message || 'Erreur lors de la creation de la session de paiement');
            // L'intervention a ete creee mais le paiement a echoue
          }
        }

        // Si pas de paiement requis ou paiement echoue, continuer normalement
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = `/interventions/${savedIntervention.id}`;
        }
      }
    } catch (err) {
      setError(isEditMode ? (t('interventions.errors.updateError') || 'Erreur lors de la mise a jour') : t('interventions.errors.createError'));
    } finally {
      if (setLoading) {
        setLoading(false);
      } else {
        setSaving(false);
      }
    }
  };

  // Verifier les droits d'acces
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header avec bouton retour et titre */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton
          onClick={() => isEditMode && interventionId ? navigate(`/interventions/${interventionId}`) : navigate('/interventions')}
          sx={{ mr: 1.5 }}
          size="small"
        >
          <ArrowBack sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography variant="h6" fontWeight={600}>
          {isEditMode
            ? (t('interventions.editTitle') || `Modifier l'intervention #${interventionId}`)
            : t('interventions.createTitle')
          }
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={rhfHandleSubmit(onSubmit)} id="intervention-form">
        <Grid container spacing={2}>
          {/* Informations principales */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  {t('interventions.sections.mainInfo')}
                </Typography>

                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <Controller
                      name="title"
                      control={control}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={t('interventions.fields.title')}
                          required
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          size="small"
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={t('interventions.fields.description')}
                          multiline
                          rows={3}
                          required
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          size="small"
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="type"
                      control={control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth required error={!!fieldState.error}>
                          <InputLabel>{t('interventions.fields.interventionType')}</InputLabel>
                          <Select
                            {...field}
                            label={t('interventions.fields.interventionType')}
                            size="small"
                          >
                            {interventionTypes.map((type) => {
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

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth required error={!!fieldState.error}>
                          <InputLabel>{t('interventions.fields.status')}</InputLabel>
                          <Select
                            {...field}
                            label={t('interventions.fields.status')}
                            size="small"
                          >
                            {statuses.map((status) => (
                              <MenuItem key={status.value} value={status.value}>
                                {status.label}
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

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="priority"
                      control={control}
                      render={({ field, fieldState }) => (
                        <FormControl fullWidth required error={!!fieldState.error}>
                          <InputLabel>{t('interventions.fields.priority')}</InputLabel>
                          <Select
                            {...field}
                            label={t('interventions.fields.priority')}
                            size="small"
                          >
                            {priorities.map((priority) => (
                              <MenuItem key={priority.value} value={priority.value}>
                                {priority.label}
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

                  {/* Date planifiée (date seule) */}
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label={t('interventions.fields.scheduledDate')}
                      type="date"
                      required
                      value={scheduledDatePart}
                      onChange={(e) => setScheduledDatePart(e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  {/* Heure de début */}
                  <Grid item xs={6} sm={4}>
                    <TextField
                      fullWidth
                      label="Heure"
                      type="time"
                      required
                      value={scheduledTimePart}
                      onChange={(e) => setScheduledTimePart(e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 900 }}
                      helperText={
                        (() => {
                          const sel = properties.find(p => p.id === watchedPropertyId);
                          return sel?.defaultCheckOutTime ? `Défaut : ${sel.defaultCheckOutTime}` : undefined;
                        })()
                      }
                    />
                  </Grid>

                  {/* Durée estimée (fractionnaire) */}
                  <Grid item xs={6} sm={4}>
                    <Controller
                      name="estimatedDurationHours"
                      control={control}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={t('interventions.fields.estimatedDuration')}
                          type="number"
                          required
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message || 'En heures (ex: 1.5 = 1h30)'}
                          inputProps={{ min: 0.5, max: 24, step: 0.5 }}
                          size="small"
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>

                  {/* Hidden field for react-hook-form scheduledDate */}
                  <Controller
                    name="scheduledDate"
                    control={control}
                    render={({ field }) => (
                      <input type="hidden" {...field} />
                    )}
                  />

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="progressPercentage"
                      control={control}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={t('interventions.fields.initialProgress')}
                          type="number"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          inputProps={{ min: 0, max: 100 }}
                          size="small"
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Informations secondaires */}
          <Grid item xs={12} md={4}>
            {/* Propriete et demandeur */}
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  {t('interventions.sections.propertyRequestor')}
                </Typography>

                <Controller
                  name="propertyId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required sx={{ mb: 1.5 }} error={!!fieldState.error}>
                      <InputLabel>{t('interventions.fields.property')}</InputLabel>
                      <Select
                        {...field}
                        label={t('interventions.fields.property')}
                        size="small"
                      >
                        {properties.map((property) => (
                          <MenuItem key={property.id} value={property.id}>
                            <Typography variant="body2">{property.name} - {property.address}, {property.city}</Typography>
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />

                <Controller
                  name="requestorId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('interventions.fields.requestor')}</InputLabel>
                      <Select
                        {...field}
                        label={t('interventions.fields.requestor')}
                        disabled={!isAdmin() && !isManager()}
                        size="small"
                      >
                        {users.map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            <Typography variant="body2">{user.firstName} {user.lastName} ({user.email})</Typography>
                          </MenuItem>
                        ))}
                      </Select>
                      {!isAdmin() && !isManager() && (
                        <FormHelperText sx={{ fontSize: '0.7rem' }}>
                          {t('interventions.fields.requestorHelper')}
                        </FormHelperText>
                      )}
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </CardContent>
            </Card>

            {/* Assignation */}
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  {t('interventions.sections.assignment')}
                </Typography>

                <Controller
                  name="assignedToType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 1.5 }}>
                      <InputLabel>{t('interventions.fields.assignmentType')}</InputLabel>
                      <Select
                        value={field.value || ''}
                        onChange={(e) => {
                          const val = e.target.value as 'user' | 'team' | '';
                          field.onChange(val || undefined);
                          setValue('assignedToId', undefined);
                        }}
                        label={t('interventions.fields.assignmentType')}
                        size="small"
                      >
                        <MenuItem value="">{t('interventions.fields.noAssignment')}</MenuItem>
                        <MenuItem value="user">{t('interventions.fields.user')}</MenuItem>
                        <MenuItem value="team">{t('interventions.fields.team')}</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />

                {watchedAssignedToType === 'user' && (
                  <Controller
                    name="assignedToId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>{t('interventions.fields.assignedUser')}</InputLabel>
                        <Select
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          label={t('interventions.fields.assignedUser')}
                          size="small"
                        >
                          {users.filter(user => ['TECHNICIAN', 'SUPERVISOR', 'MANAGER'].includes(user.role)).map((user) => (
                            <MenuItem key={user.id} value={user.id}>
                              <Typography variant="body2">{user.firstName} {user.lastName} ({user.role})</Typography>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                )}

                {watchedAssignedToType === 'team' && (
                  <Controller
                    name="assignedToId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>{t('interventions.fields.assignedTeam')}</InputLabel>
                        <Select
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          label={t('interventions.fields.assignedTeam')}
                          size="small"
                        >
                          {teams.map((team) => (
                            <MenuItem key={team.id} value={team.id}>
                              <Typography variant="body2">{team.name} ({team.interventionType})</Typography>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Couts - Seulement pour les admins et managers, pas pour les HOST */}
            {!isHost() && (
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                    {t('interventions.sections.costs')}
                  </Typography>

                  <Controller
                    name="estimatedCost"
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        fullWidth
                        label={t('interventions.fields.estimatedCost')}
                        type="number"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        inputProps={{ min: 0, step: 0.01 }}
                        size="small"
                      />
                    )}
                  />
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Notes et photos */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  {t('interventions.sections.notesPhotos')}
                </Typography>

                <Controller
                  name="notes"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('interventions.fields.notes')}
                      multiline
                      rows={3}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      sx={{ mb: 1.5 }}
                      size="small"
                    />
                  )}
                />

                <Controller
                  name="photos"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('interventions.fields.photosUrl')}
                      placeholder={t('interventions.fields.photosUrlPlaceholder')}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      size="small"
                    />
                  )}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Bouton de soumission cache pour le PageHeader */}
        <Button
          type="submit"
          sx={{ display: 'none' }}
          data-submit-intervention
        >
          {t('common.submit')}
        </Button>
      </form>
    </Box>
  );
};

export default InterventionForm;
