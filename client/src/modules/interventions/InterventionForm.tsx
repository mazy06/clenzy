import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  ArrowBack
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionSchema, type InterventionFormValues } from '../../schemas';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, propertiesApi, usersApi, teamsApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { extractApiList } from '../../types';
import { InterventionType } from '../../types/interventionTypes';
import { InterventionStatus, Priority } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import { interventionsKeys } from './useInterventionsList';
import InterventionFormMainInfo from './InterventionFormMainInfo';
import InterventionFormPropertyRequestor from './InterventionFormPropertyRequestor';
import InterventionFormAssignment from './InterventionFormAssignment';
import InterventionFormCostsNotes from './InterventionFormCostsNotes';

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

interface InterventionFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
  // Edit mode props
  interventionId?: number;  // If provided, form is in edit mode
  mode?: 'create' | 'edit'; // Default: 'create'
}

// ─── Query keys for form data ─────────────────────────────────────────────────

const formDataKeys = {
  all: ['intervention-form-data'] as const,
  properties: () => [...formDataKeys.all, 'properties'] as const,
  users: () => [...formDataKeys.all, 'users'] as const,
  teams: () => [...formDataKeys.all, 'teams'] as const,
  intervention: (id: number) => [...formDataKeys.all, 'intervention', id] as const,
};

const InterventionForm: React.FC<InterventionFormProps> = ({ onClose, onSuccess, setLoading, loading, interventionId, mode }) => {
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const [error, setError] = useState<string | null>(null);
  // Separate date/time state for scheduled date
  const [scheduledDatePart, setScheduledDatePart] = useState('');
  const [scheduledTimePart, setScheduledTimePart] = useState('11:00');

  const { control, handleSubmit: rhfHandleSubmit, watch, setValue, reset, formState: { errors } } = useForm<InterventionFormValues>({
    // zodResolver v4 type mismatch with react-hook-form v7 — safe cast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // ─── React Query: load form reference data ─────────────────────────────────

  const propertiesQuery = useQuery({
    queryKey: formDataKeys.properties(),
    queryFn: async () => {
      const data = await propertiesApi.getAll();
      return extractApiList<Property>(data);
    },
    staleTime: 60_000,
  });

  const usersQuery = useQuery({
    queryKey: formDataKeys.users(),
    queryFn: async () => {
      const data = await usersApi.getAll();
      return extractApiList<User>(data);
    },
    staleTime: 60_000,
  });

  const teamsQuery = useQuery({
    queryKey: formDataKeys.teams(),
    queryFn: async () => {
      const data = await teamsApi.getAll();
      return extractApiList<Team>(data);
    },
    staleTime: 60_000,
  });

  const interventionQuery = useQuery({
    queryKey: formDataKeys.intervention(interventionId!),
    queryFn: () => interventionsApi.getById(interventionId!),
    enabled: isEditMode && !!interventionId,
    staleTime: 30_000,
  });

  const properties = propertiesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const isLoading = propertiesQuery.isLoading || usersQuery.isLoading || teamsQuery.isLoading || (isEditMode && interventionQuery.isLoading);

  // Populate form with intervention data when loaded (edit mode)
  useEffect(() => {
    if (!isEditMode || !interventionQuery.data) return;
    const interventionData = interventionQuery.data;

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
  }, [isEditMode, interventionQuery.data, reset]);

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

  // ─── Mutation: create/update intervention ───────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async (formData: InterventionFormValues) => {
      if (isEditMode && interventionId) {
        await interventionsApi.update(interventionId, formData);
        return { type: 'update' as const, id: interventionId };
      } else {
        const saved = await interventionsApi.create(formData);
        return { type: 'create' as const, id: saved.id, estimatedCost: formData.estimatedCost };
      }
    },
    onSuccess: async (result, formData) => {
      // Invalidate interventions cache
      queryClient.invalidateQueries({ queryKey: interventionsKeys.all });

      if (result.type === 'update') {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate(`/interventions/${result.id}`);
        }
      } else {
        // Create mode: handle payment flow
        if (!isHost() && formData.estimatedCost && formData.estimatedCost > 0) {
          try {
            const paymentData = await apiClient.post<{ url: string }>('/payments/create-session', {
              interventionId: result.id,
              amount: formData.estimatedCost
            });
            window.location.href = paymentData.url;
            return;
          } catch (paymentErr: unknown) {
            setError(paymentErr instanceof Error ? paymentErr.message : 'Erreur lors de la creation de la session de paiement');
          }
        }

        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = `/interventions/${result.id}`;
        }
      }
    },
    onError: () => {
      setError(isEditMode ? (t('interventions.errors.updateError') || 'Erreur lors de la mise a jour') : t('interventions.errors.createError'));
    },
  });

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

  const onSubmit = (formData: InterventionFormValues) => {
    if (!isEditMode && (!formData.propertyId || !formData.requestorId)) {
      setError(t('interventions.errors.selectPropertyRequestor'));
      return;
    }

    if (setLoading) setLoading(true);
    setError(null);
    submitMutation.mutate(formData, {
      onSettled: () => {
        if (setLoading) setLoading(false);
      },
    });
  };

  const saving = submitMutation.isPending;

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
          <InterventionFormMainInfo
            control={control}
            errors={errors}
            scheduledDatePart={scheduledDatePart}
            scheduledTimePart={scheduledTimePart}
            setScheduledDatePart={setScheduledDatePart}
            setScheduledTimePart={setScheduledTimePart}
            properties={properties}
            watchedPropertyId={watchedPropertyId}
          />

          {/* Informations secondaires */}
          <Grid item xs={12} md={4}>
            {/* Propriete et demandeur */}
            <InterventionFormPropertyRequestor
              control={control}
              errors={errors}
              properties={properties}
              users={users}
              isAdmin={isAdmin}
              isManager={isManager}
            />

            {/* Assignation */}
            <InterventionFormAssignment
              control={control}
              errors={errors}
              setValue={setValue}
              users={users}
              teams={teams}
              watchedAssignedToType={watchedAssignedToType}
            />

            {/* Couts et Notes/Photos */}
            <InterventionFormCostsNotes
              control={control}
              errors={errors}
              isHost={isHost}
            />
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
