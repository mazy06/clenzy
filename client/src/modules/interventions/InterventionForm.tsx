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
import { interventionSchema, type InterventionFormValues } from '../../schemas';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, propertiesApi, usersApi, teamsApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { extractApiList } from '../../types';
import type { Intervention } from '../../types';
import { InterventionType } from '../../types/interventionTypes';
import { InterventionStatus, Priority } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
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

  const { control, handleSubmit: rhfHandleSubmit, watch, setValue, reset, formState: { errors } } = useForm<InterventionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(interventionSchema) as any, // zodResolver type mismatch with react-hook-form
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
        let interventionData: Intervention | null = null;
        if (isEditMode && interventionId) {
          interventionData = await interventionsApi.getById(interventionId);
        }

        setProperties(extractApiList(propertiesData));
        setUsers(extractApiList(usersData));
        setTeams(extractApiList(teamsData));

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
        await interventionsApi.update(interventionId, formData);

        if (onSuccess) {
          onSuccess();
        } else {
          navigate(`/interventions/${interventionId}`);
        }
      } else {
        // ── Create mode: create a new intervention ──
        const savedIntervention = await interventionsApi.create(formData);

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
