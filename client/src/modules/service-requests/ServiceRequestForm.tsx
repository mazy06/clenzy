import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Collapse,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { serviceRequestsApi, propertiesApi, usersApi, teamsApi, reservationsApi } from '../../services/api';
import type { Reservation } from '../../services/api';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../hooks/useTranslation';
import { pricingConfigApi } from '../../services/api/pricingConfigApi';
import type { ForfaitConfig } from '../../services/api/pricingConfigApi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceRequestSchema } from '../../schemas';
import type { ServiceRequestFormValues } from '../../schemas';

import ServiceRequestFormInfo from './ServiceRequestFormInfo';
import ServiceRequestFormProperty from './ServiceRequestFormProperty';
import ServiceRequestFormPlanning from './ServiceRequestFormPlanning';
import ServiceRequestFormAssignment from './ServiceRequestFormAssignment';
import ServiceRequestPriceEstimate from './ServiceRequestPriceEstimate';

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

// Type pour les propriétés (tous les champs utiles pour auto-fill + estimation)
interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  description?: string;
  ownerId?: number;
  // Caractéristiques logement
  bedroomCount?: number;
  bathroomCount?: number;
  squareMeters?: number;
  maxGuests?: number;
  // Tarification ménage
  cleaningDurationMinutes?: number;
  cleaningBasePrice?: number;
  cleaningNotes?: string;
  cleaningFrequency?: string;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  // Prestations à la carte
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  // Check-in/out
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [propertyReservations, setPropertyReservations] = useState<Reservation[]>([]);
  const [forfaitConfigs, setForfaitConfigs] = useState<ForfaitConfig[]>([]);

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
  const watchedServiceType = watch('serviceType');
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
        const data = await propertiesApi.getAll({ size: 1000 });
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

  // Charger la configuration des forfaits
  useEffect(() => {
    const loadPricingConfig = async () => {
      try {
        const data = await pricingConfigApi.get();
        if (data.forfaitConfigs?.length) {
          setForfaitConfigs(data.forfaitConfigs);
        }
      } catch {
        // Fallback to defaults silently
      }
    };
    loadPricingConfig();
  }, []);

  // Charger les réservations de la propriété sélectionnée
  useEffect(() => {
    if (!watchedPropertyId || watchedPropertyId === 0) {
      setPropertyReservations([]);
      return;
    }

    const loadReservations = async () => {
      try {
        const data = await reservationsApi.getByProperty(watchedPropertyId);
        setPropertyReservations(data);
      } catch (err) {
        setPropertyReservations([]);
      }
    };

    loadReservations();
  }, [watchedPropertyId]);

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
  useEffect(() => {
    const checkPermissions = async () => {
      const permission = isEditMode ? 'service-requests:edit' : 'service-requests:create';
      const hasPerms = await hasPermissionAsync(permission);
      setHasPermission(hasPerms);
    };

    checkPermissions();
  }, [hasPermissionAsync, isEditMode]);

  // ─── Submit handler (defined before guards so hooks below can reference it) ──
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
  useEffect(() => {
    if (submitRef) {
      submitRef.current = rhfHandleSubmit(onSubmit);
    }
    return () => {
      if (submitRef) submitRef.current = null;
    };
  });

  // Propriété sélectionnée (pour auto-fill + coût estimé)
  const selectedProperty = properties.find(p => p.id === watchedPropertyId) || null;

  // Auto-fill form fields from selected property (create mode only)
  // Stocke la durée exacte en fractional hours (ex: 290 min → 4.833h) pour s'aligner avec PriceEstimate
  useEffect(() => {
    if (isEditMode || !watchedPropertyId || watchedPropertyId === 0) return;

    const prop = properties.find(p => p.id === watchedPropertyId);
    if (!prop) return;

    /** Convertir minutes → fractional hours (arrondi au millième) */
    const minsToHours = (mins: number) => Math.round((mins / 60) * 1000) / 1000;

    // Durée estimée : utiliser cleaningDurationMinutes, ou calculer depuis les caractéristiques
    if (prop.cleaningDurationMinutes) {
      setValue('estimatedDurationHours', minsToHours(prop.cleaningDurationMinutes));
    } else if ((prop.bedroomCount ?? 0) > 0 || (prop.squareMeters ?? 0) > 0) {
      // Calcul depuis les caractéristiques du logement (même algorithme que CleaningPriceEstimator / PriceEstimate)
      const bedrooms = prop.bedroomCount ?? 1;
      let baseMins: number;
      if (bedrooms <= 1)      baseMins = 90;
      else if (bedrooms === 2) baseMins = 120;
      else if (bedrooms === 3) baseMins = 150;
      else if (bedrooms === 4) baseMins = 180;
      else                      baseMins = 210;

      if ((prop.bathroomCount ?? 1) > 1) baseMins += ((prop.bathroomCount ?? 1) - 1) * 15;
      if ((prop.squareMeters ?? 0) > 80) baseMins += Math.floor(((prop.squareMeters ?? 0) - 80) / 5);
      if (prop.numberOfFloors != null && prop.numberOfFloors > 1) baseMins += (prop.numberOfFloors - 1) * 15;
      baseMins += (prop.windowCount ?? 0) * 5;
      baseMins += (prop.frenchDoorCount ?? 0) * 8;
      baseMins += (prop.slidingDoorCount ?? 0) * 12;
      if (prop.hasLaundry)      baseMins += 10;
      if (prop.hasIroning)      baseMins += 20;
      if (prop.hasDeepKitchen)  baseMins += 30;
      if (prop.hasExterior)     baseMins += 25;
      if (prop.hasDisinfection) baseMins += 40;

      setValue('estimatedDurationHours', minsToHours(baseMins));
    }

  }, [watchedPropertyId, properties, isEditMode, setValue]);

  // Auto-fill demandeur (userId) avec le propriétaire de la propriété sélectionnée
  // Pour un admin/manager, on pré-sélectionne le owner de la propriété
  // Pour un host, c'est déjà géré par le useEffect "Définir l'utilisateur par défaut selon le rôle"
  useEffect(() => {
    if (isEditMode || !watchedPropertyId || watchedPropertyId === 0) return;

    const prop = properties.find(p => p.id === watchedPropertyId);
    if (!prop?.ownerId) return;

    // Trouver le propriétaire dans la liste des utilisateurs
    const owner = users.find(u => u.id.toString() === prop.ownerId?.toString());
    if (owner) {
      setValue('userId', owner.id);
    }
  }, [watchedPropertyId, properties, users, isEditMode, setValue]);

  // Déterminer le forfait sélectionné en fonction du type de service
  const selectedForfaitKey = useMemo(() => {
    if (!watchedServiceType) return undefined;
    const match = forfaitConfigs.find((f) =>
      (f.serviceTypes || []).includes(watchedServiceType)
    );
    return match?.key;
  }, [watchedServiceType, forfaitConfigs]);

  // Équipes éligibles selon le forfait sélectionné
  const eligibleTeamIds = useMemo(() => {
    if (!selectedForfaitKey) return undefined;
    const forfait = forfaitConfigs.find((f) => f.key === selectedForfaitKey);
    if (!forfait || !forfait.eligibleTeamIds?.length) return undefined;
    return forfait.eligibleTeamIds;
  }, [selectedForfaitKey, forfaitConfigs]);

  // Prestations incluses / en supplément du forfait sélectionné
  const selectedForfait = useMemo(() => {
    if (!selectedForfaitKey) return undefined;
    return forfaitConfigs.find((f) => f.key === selectedForfaitKey);
  }, [selectedForfaitKey, forfaitConfigs]);

  const isAdminOrManager = isAdmin() || isManager();
  const isPropertySelected = !!watchedPropertyId && watchedPropertyId !== 0;

  // ─── Guards (all hooks are above this line) ──────────────────────────────

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

  return (
    <Box>
      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 1.5, py: 0.75, fontSize: '0.8125rem' }}>
          {error}
        </Alert>
      )}

      {isEditMode && success && (
        <Alert severity="success" sx={{ mb: 1.5, py: 0.75, fontSize: '0.8125rem' }}>
          {t('serviceRequests.updateRequestSuccess')}
        </Alert>
      )}

      {/* Estimation prix — visible uniquement quand une propriété est sélectionnée */}
      <Collapse in={isPropertySelected} timeout={400}>
        <Box sx={{ flexShrink: 0, mb: 1.5 }}>
          <ServiceRequestPriceEstimate
            property={selectedProperty}
            forfaitConfigs={forfaitConfigs}
            selectedForfaitKey={selectedForfaitKey}
          />
        </Box>
      </Collapse>

      {/* Formulaire */}
      <form onSubmit={rhfHandleSubmit(onSubmit)}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          {/* ─── Colonne gauche : Propriété + Infos ─── */}
          <Box sx={{ flex: isPropertySelected ? 7 : 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, transition: 'flex 0.4s ease' }}>
            {/* 1. Propriété — en premier pour auto-fill */}
            <Paper sx={{ border: '1px solid', borderColor: isPropertySelected ? 'divider' : 'primary.main', boxShadow: isPropertySelected ? 'none' : '0 0 0 1px rgba(107,138,154,0.2)', borderRadius: 1.5, p: 2, transition: 'border-color 0.3s ease, box-shadow 0.3s ease' }}>
              <ServiceRequestFormProperty
                control={control}
                errors={errors}
                properties={properties}
                users={users}
                isAdminOrManager={isAdminOrManager}
                selectedProperty={selectedProperty}
              />
            </Paper>

            {/* Message d'aide quand aucune propriété n'est sélectionnée */}
            <Collapse in={!isPropertySelected} timeout={300}>
              <Alert
                severity="info"
                sx={{
                  py: 0.75,
                  fontSize: '0.8125rem',
                  borderRadius: 1.5,
                  '& .MuiAlert-icon': { fontSize: 18 },
                }}
              >
                {t('serviceRequests.selectPropertyFirst')}
              </Alert>
            </Collapse>

            {/* 2. Informations de base — révélé quand propriété sélectionnée */}
            <Collapse in={isPropertySelected} timeout={400}>
              <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 2 }}>
                <ServiceRequestFormInfo
                  control={control}
                  errors={errors}
                  setValue={setValue}
                  watchedServiceType={watchedServiceType}
                  disabled={!isPropertySelected}
                  propertyDescription={selectedProperty?.description}
                  cleaningNotes={selectedProperty?.cleaningNotes}
                  selectedProperty={selectedProperty}
                  includedPrestations={selectedForfait?.includedPrestations}
                  extraPrestations={selectedForfait?.extraPrestations}
                />
              </Paper>
            </Collapse>
          </Box>

          {/* ─── Colonne droite : Planification + Assignation — révélée quand propriété sélectionnée ─── */}
          {isPropertySelected && (
            <Box sx={{ flex: 5, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, animation: 'fadeSlideIn 0.4s ease-out', '@keyframes fadeSlideIn': { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } } }}>
              {/* 3. Planification */}
              <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 2 }}>
                <ServiceRequestFormPlanning
                  control={control}
                  errors={errors}
                  setValue={setValue}
                  disabled={!isPropertySelected}
                  isAdminOrManager={isAdminOrManager}
                  reservations={propertyReservations}
                />
              </Paper>

              {/* 4. Assignation et statut */}
              <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 2 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1.5 }}>
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
                  watchedServiceType={watchedServiceType}
                  isEditMode={isEditMode}
                  disabled={!isPropertySelected}
                  eligibleTeamIds={eligibleTeamIds}
                />
              </Paper>
            </Box>
          )}
        </Box>
      </form>

      {/* Bouton de soumission caché pour le PageHeader */}
      <Button
        type="submit"
        sx={{ display: 'none' }}
        data-submit-service-request
      >
        Soumettre
      </Button>
    </Box>
  );
};

export default ServiceRequestForm;
