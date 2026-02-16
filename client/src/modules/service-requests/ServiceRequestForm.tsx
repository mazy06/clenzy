import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { serviceRequestsApi, propertiesApi, usersApi, teamsApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../hooks/useTranslation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceRequestSchema } from '../../schemas';
import type { ServiceRequestFormValues } from '../../schemas';

import ServiceRequestFormInfo from './ServiceRequestFormInfo';
import ServiceRequestFormProperty from './ServiceRequestFormProperty';
import ServiceRequestFormPlanning from './ServiceRequestFormPlanning';
import ServiceRequestFormAssignment from './ServiceRequestFormAssignment';

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
  /** Ref that exposes a submit() trigger to parent — replaces DOM querySelector hack */
  submitRef?: React.MutableRefObject<(() => void) | null>;
  // Edit mode props
  serviceRequestId?: number;
  mode?: 'create' | 'edit';
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({ onClose, onSuccess, setLoading, loading, submitRef, serviceRequestId, mode = 'create' }) => {
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
  const { control, handleSubmit: rhfHandleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ServiceRequestFormValues>({
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
        const sr = await serviceRequestsApi.getById(serviceRequestId);

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

  // Expose submit trigger to parent via ref — replaces DOM querySelector hack
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (submitRef) {
      submitRef.current = rhfHandleSubmit(onSubmit);
    }
    return () => {
      if (submitRef) submitRef.current = null;
    };
  });

  const isAdminOrManager = isAdmin() || isManager();

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
            <ServiceRequestFormInfo
              control={control}
              errors={errors}
            />

            <ServiceRequestFormProperty
              control={control}
              errors={errors}
              properties={properties}
              users={users}
              isAdminOrManager={isAdminOrManager}
            />

            <ServiceRequestFormPlanning
              control={control}
              errors={errors}
            />

            {/* Assignation et statut */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
              {t('serviceRequests.sections.requestorAssignment')}
            </Typography>

            <ServiceRequestFormAssignment
              control={control}
              errors={errors}
              setValue={setValue}
              users={users}
              teams={teams}
              canAssignForProperty={canAssignForProperty}
              watchedAssignedToType={watchedAssignedToType}
              isEditMode={isEditMode}
            />

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
