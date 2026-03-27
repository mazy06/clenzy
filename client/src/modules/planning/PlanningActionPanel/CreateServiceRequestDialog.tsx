import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Link,
  Stepper,
  Step,
  StepLabel,
  Chip,
} from '@mui/material';
import {
  Close,
  Send,
  ArrowBack,
  ArrowForward,
  Home,
  Person,
  Bed,
  Bathtub,
  SquareFoot,
  Layers,
  Deck,
  LocalLaundryService,
  People,
  Category,
  Window,
  DoorSliding,
  Iron,
  Kitchen,
  AutoAwesome,
  Warning as WarningIcon,
  Timer,
  Euro,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import apiClient from '../../../services/apiClient';
import { propertiesApi, usersApi, teamsApi, reservationsApi } from '../../../services/api';
import type { Reservation } from '../../../services/api';
import { interventionsApi } from '../../../services/api/interventionsApi';
import type { TeamMemberAvailability, UserAvailabilityResponse } from '../../../services/api/interventionsApi';
import { pricingConfigApi } from '../../../services/api/pricingConfigApi';
import type { ForfaitConfig } from '../../../services/api/pricingConfigApi';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceRequestSchema } from '../../../schemas';
import type { ServiceRequestFormValues } from '../../../schemas';
import { INTERVENTION_TYPE_OPTIONS } from '../../../types/interventionTypes';
import { getPropertyTypeLabel } from '../../../utils/statusUtils';
import { computeEstimatedDuration, formatDuration, computeRangeFromForfait } from '../../service-requests/ServiceRequestPriceEstimate';
import { useCurrency } from '../../../hooks/useCurrency';

// Sub-components from full form
import ServiceRequestFormInfo from '../../service-requests/ServiceRequestFormInfo';
import ServiceRequestFormPlanning from '../../service-requests/ServiceRequestFormPlanning';
import ServiceRequestFormAssignment from '../../service-requests/ServiceRequestFormAssignment';

// ── Types ───────────────────────────────────────────────────────────────────
interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  description?: string;
  ownerId?: number;
  bedroomCount?: number;
  bathroomCount?: number;
  squareMeters?: number;
  maxGuests?: number;
  cleaningDurationMinutes?: number;
  cleaningBasePrice?: number;
  cleaningNotes?: string;
  cleaningFrequency?: string;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
}

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
  memberCount: number;
}

// ── Steps ───────────────────────────────────────────────────────────────────
const STEPS = ['Service', 'Planification', 'Assignation'];

// ── Props ───────────────────────────────────────────────────────────────────
interface CreateServiceRequestDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: number;
  propertyName: string;
  /** Link service request to a specific reservation */
  reservationId?: number;
  /** Pre-select a service type category */
  defaultServiceType?: string;
  /** Pre-fill desired date (e.g. reservation checkOut) */
  defaultDesiredDate?: string;
  /** Callback after successful creation */
  onCreated?: (serviceRequestId: number) => void;
}

// ── Tag chip styles ─────────────────────────────────────────────────────────
const TAG_SX = {
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'text.secondary',
  borderWidth: 1,
  borderColor: 'grey.200',
  '& .MuiChip-icon': { fontSize: 12, ml: 0.25, color: 'primary.main' },
  '& .MuiChip-label': { px: 0.5 },
} as const;

const CreateServiceRequestDialog: React.FC<CreateServiceRequestDialogProps> = ({
  open,
  onClose,
  propertyId,
  propertyName,
  reservationId,
  defaultServiceType,
  defaultDesiredDate,
  onCreated,
}) => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();

  // ── Stepper state ───────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);

  // ── Data loading ────────────────────────────────────────────────────────
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [forfaitConfigs, setForfaitConfigs] = useState<ForfaitConfig[]>([]);
  const [propertyReservations, setPropertyReservations] = useState<Reservation[]>([]);
  const [canAssignForProperty, setCanAssignForProperty] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // ── Conflict detection state ────────────────────────────────────────────
  const [conflictMembers, setConflictMembers] = useState<TeamMemberAvailability[]>([]);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{ allAvailable: boolean; teamName: string; teamConflictCount: number } | null>(null);
  const [userConflictInfo, setUserConflictInfo] = useState<UserAvailabilityResponse | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  const isAdminOrManager = isAdmin() || isManager();

  // ── React Hook Form ─────────────────────────────────────────────────────
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

  const watchedServiceType = watch('serviceType');
  const watchedAssignedToType = watch('assignedToType');
  const watchedAssignedToId = watch('assignedToId');
  const watchedDesiredDate = watch('desiredDate');
  const watchedEstimatedDuration = watch('estimatedDurationHours');

  // ── Reset form when dialog opens ────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setError(null);
      setCreatedId(null);
      setConflictMembers([]);
      setConflictInfo(null);
      setUserConflictInfo(null);
      setHasConflict(false);

      const defaultDate = defaultDesiredDate
        ? (() => {
            const d = new Date(defaultDesiredDate);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}T11:00`;
          })()
        : '';

      reset({
        title: '',
        description: '',
        propertyId,
        serviceType: defaultServiceType || 'CLEANING',
        priority: 'NORMAL',
        estimatedDurationHours: 1,
        desiredDate: defaultDate,
        userId: user?.databaseId || undefined,
        assignedToId: undefined,
        assignedToType: undefined,
        status: undefined,
      });
    }
  }, [open, defaultServiceType, defaultDesiredDate, propertyId, user?.databaseId, reset]);

  // ── Load properties (for characteristics) ───────────────────────────────
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoadingData(true);
      try {
        const data = await propertiesApi.getAll({ size: 1000 });
        const list = ((data as unknown as { content?: Property[] }).content || data) as unknown as Property[];
        setProperties(list);
      } catch {
        // silent
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [open]);

  // ── Load users (admin/manager only) ─────────────────────────────────────
  useEffect(() => {
    if (!open || isHost()) return;

    const load = async () => {
      try {
        const data = await usersApi.getAll();
        const list = ((data as unknown as { content?: User[] }).content || data) as unknown as User[];
        setUsers(list);
      } catch {
        // silent
      }
    };
    load();
  }, [open, isHost]);

  // ── HOST: inject self user ──────────────────────────────────────────────
  useEffect(() => {
    if (!open || !isHost() || !user?.databaseId) return;

    const selfUser: User = {
      id: user.databaseId,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: 'HOST',
    };
    setUsers(prev => {
      if (prev.some(u => u.id === user.databaseId)) return prev;
      return [selfUser];
    });
  }, [open, isHost, user?.databaseId, user?.firstName, user?.lastName, user?.email]);

  // ── Load teams ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const data = await teamsApi.getAll();
        const list = ((data as unknown as { content?: Team[] }).content || data) as unknown as Team[];
        setTeams(list);
      } catch {
        // silent
      }
    };
    load();
  }, [open]);

  // ── Load forfait configs ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const data = await pricingConfigApi.get();
        if (data.forfaitConfigs?.length) {
          setForfaitConfigs(data.forfaitConfigs);
        }
      } catch {
        // silent
      }
    };
    load();
  }, [open]);

  // ── Load reservations for property ──────────────────────────────────────
  useEffect(() => {
    if (!open || !propertyId) {
      setPropertyReservations([]);
      return;
    }

    const load = async () => {
      try {
        const data = await reservationsApi.getByProperty(propertyId);
        setPropertyReservations(data);
      } catch {
        setPropertyReservations([]);
      }
    };
    load();
  }, [open, propertyId]);

  // ── Check can-assign ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !propertyId) {
      setCanAssignForProperty(false);
      return;
    }

    const check = async () => {
      try {
        const data = await apiClient.get<{ canAssign: boolean }>(`/properties/${propertyId}/can-assign`);
        setCanAssignForProperty(data.canAssign || false);
      } catch {
        setCanAssignForProperty(false);
      }
    };
    check();
  }, [open, propertyId]);

  // ── Conflict detection: check team/user availability when assigned + date are set ─
  useEffect(() => {
    // Nothing selected or no date → clear
    if (!watchedAssignedToType || !watchedAssignedToId || !watchedDesiredDate) {
      setConflictMembers([]);
      setConflictInfo(null);
      setUserConflictInfo(null);
      setHasConflict(false);
      return;
    }

    let cancelled = false;
    setConflictLoading(true);

    // Parse desired date to ISO format for the backend
    const dateStr = new Date(watchedDesiredDate).toISOString().replace('Z', '');
    const duration = watchedEstimatedDuration || 4;

    if (watchedAssignedToType === 'team') {
      // ── Team availability check ──
      setUserConflictInfo(null);
      interventionsApi
        .checkTeamAvailabilityByDate(watchedAssignedToId, dateStr, duration)
        .then((data) => {
          if (cancelled) return;
          setConflictMembers(data.members || []);
          const anyConflict = !data.allAvailable || data.teamConflictCount > 0;
          setConflictInfo({
            allAvailable: data.allAvailable,
            teamName: data.teamName,
            teamConflictCount: data.teamConflictCount,
          });
          setHasConflict(anyConflict);
        })
        .catch(() => {
          if (cancelled) return;
          setConflictMembers([]);
          setConflictInfo(null);
          setHasConflict(false);
        })
        .finally(() => {
          if (!cancelled) setConflictLoading(false);
        });
    } else if (watchedAssignedToType === 'user') {
      // ── Individual user availability check ──
      setConflictMembers([]);
      setConflictInfo(null);
      interventionsApi
        .checkUserAvailabilityByDate(watchedAssignedToId, dateStr, duration)
        .then((data) => {
          if (cancelled) return;
          setUserConflictInfo(data);
          setHasConflict(!data.available);
        })
        .catch(() => {
          if (cancelled) return;
          setUserConflictInfo(null);
          setHasConflict(false);
        })
        .finally(() => {
          if (!cancelled) setConflictLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [watchedAssignedToType, watchedAssignedToId, watchedDesiredDate, watchedEstimatedDuration]);

  // ── Selected property ───────────────────────────────────────────────────
  const selectedProperty = useMemo(
    () => properties.find(p => p.id === propertyId) || null,
    [properties, propertyId],
  );

  // ── Auto-fill duration from property characteristics ────────────────────
  useEffect(() => {
    if (!selectedProperty) return;

    const minsToHours = (mins: number) => Math.round((mins / 60) * 1000) / 1000;

    if (selectedProperty.cleaningDurationMinutes) {
      setValue('estimatedDurationHours', minsToHours(selectedProperty.cleaningDurationMinutes));
    } else if ((selectedProperty.bedroomCount ?? 0) > 0 || (selectedProperty.squareMeters ?? 0) > 0) {
      const bedrooms = selectedProperty.bedroomCount ?? 1;
      let baseMins: number;
      if (bedrooms <= 1) baseMins = 90;
      else if (bedrooms === 2) baseMins = 120;
      else if (bedrooms === 3) baseMins = 150;
      else if (bedrooms === 4) baseMins = 180;
      else baseMins = 210;

      if ((selectedProperty.bathroomCount ?? 1) > 1) baseMins += ((selectedProperty.bathroomCount ?? 1) - 1) * 15;
      if ((selectedProperty.squareMeters ?? 0) > 80) baseMins += Math.floor(((selectedProperty.squareMeters ?? 0) - 80) / 5);
      if (selectedProperty.numberOfFloors != null && selectedProperty.numberOfFloors > 1) baseMins += (selectedProperty.numberOfFloors - 1) * 15;
      baseMins += (selectedProperty.windowCount ?? 0) * 5;
      baseMins += (selectedProperty.frenchDoorCount ?? 0) * 8;
      baseMins += (selectedProperty.slidingDoorCount ?? 0) * 12;
      if (selectedProperty.hasLaundry) baseMins += 10;
      if (selectedProperty.hasIroning) baseMins += 20;
      if (selectedProperty.hasDeepKitchen) baseMins += 30;
      if (selectedProperty.hasExterior) baseMins += 25;
      if (selectedProperty.hasDisinfection) baseMins += 40;

      setValue('estimatedDurationHours', minsToHours(baseMins));
    }
  }, [selectedProperty, setValue]);

  // ── Demandeur = toujours l'utilisateur connecté (traçabilité) ─────────
  // On ne pré-sélectionne plus le propriétaire du logement : le demandeur
  // est systématiquement la personne qui crée la demande.

  // ── Auto-generate title ─────────────────────────────────────────────────
  useEffect(() => {
    if (!watchedServiceType) return;
    const option = INTERVENTION_TYPE_OPTIONS.find(o => o.value === watchedServiceType);
    const label = option?.label || watchedServiceType;
    setValue('title', `${label} - ${propertyName}`);
  }, [watchedServiceType, propertyName, setValue]);

  // ── Forfait matching ────────────────────────────────────────────────────
  const selectedForfaitKey = useMemo(() => {
    if (!watchedServiceType) return undefined;
    const match = forfaitConfigs.find(f => (f.serviceTypes || []).includes(watchedServiceType));
    return match?.key;
  }, [watchedServiceType, forfaitConfigs]);

  const selectedForfait = useMemo(() => {
    if (!selectedForfaitKey) return undefined;
    return forfaitConfigs.find(f => f.key === selectedForfaitKey);
  }, [selectedForfaitKey, forfaitConfigs]);

  const eligibleTeamIds = useMemo(() => {
    if (!selectedForfait || !selectedForfait.eligibleTeamIds?.length) return undefined;
    return selectedForfait.eligibleTeamIds;
  }, [selectedForfait]);

  // ── Dynamic estimation (prix + durée) ────────────────────────────────
  const estimatedDuration = useMemo(() => {
    if (!selectedProperty) return 0;
    return computeEstimatedDuration(selectedProperty);
  }, [selectedProperty]);

  const priceRange = useMemo(() => {
    if (!selectedProperty || !selectedForfait) return null;
    return computeRangeFromForfait(
      selectedProperty.squareMeters ?? 0,
      selectedProperty.bedroomCount ?? 1,
      selectedProperty.bathroomCount ?? 1,
      selectedProperty.maxGuests ?? 2,
      selectedProperty.numberOfFloors ?? undefined,
      selectedProperty.hasExterior ?? false,
      selectedProperty.hasLaundry ?? false,
      selectedProperty.cleaningBasePrice ?? undefined,
      selectedForfait,
    );
  }, [selectedProperty, selectedForfait]);

  // ── Current user info for demandeur label ─────────────────────────────
  const currentUserLabel = useMemo(() => {
    if (!user) return '';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '';
    return name;
  }, [user]);

  const currentUserRole = useMemo(() => {
    if (!user) return '';
    if (isAdmin()) return 'Admin';
    if (isManager()) return 'Manager';
    if (isHost()) return 'Propriétaire';
    return '';
  }, [user, isAdmin, isManager, isHost]);

  // ── Property tags (characteristics) ─────────────────────────────────────
  const propertyTags = useMemo(() => {
    if (!selectedProperty) return [];
    const tags: { icon: React.ReactElement; label: string }[] = [];

    if (selectedProperty.type) {
      tags.push({ icon: <Category sx={{ fontSize: 12 }} />, label: getPropertyTypeLabel(selectedProperty.type, t) });
    }
    if (selectedProperty.squareMeters && selectedProperty.squareMeters > 0) {
      tags.push({ icon: <SquareFoot sx={{ fontSize: 12 }} />, label: `${selectedProperty.squareMeters} m²` });
    }
    if (selectedProperty.bedroomCount && selectedProperty.bedroomCount > 0) {
      tags.push({ icon: <Bed sx={{ fontSize: 12 }} />, label: `${selectedProperty.bedroomCount} ${selectedProperty.bedroomCount > 1 ? 'chambres' : 'chambre'}` });
    }
    if (selectedProperty.bathroomCount && selectedProperty.bathroomCount > 0) {
      tags.push({ icon: <Bathtub sx={{ fontSize: 12 }} />, label: `${selectedProperty.bathroomCount} SDB` });
    }
    if (selectedProperty.maxGuests && selectedProperty.maxGuests > 0) {
      tags.push({ icon: <People sx={{ fontSize: 12 }} />, label: `${selectedProperty.maxGuests} voyageurs` });
    }
    if (selectedProperty.hasExterior) {
      tags.push({ icon: <Deck sx={{ fontSize: 12 }} />, label: 'Extérieur' });
    }
    if (selectedProperty.hasLaundry) {
      tags.push({ icon: <LocalLaundryService sx={{ fontSize: 12 }} />, label: 'Linge' });
    }
    if (selectedProperty.windowCount && selectedProperty.windowCount > 0) {
      tags.push({ icon: <Window sx={{ fontSize: 12 }} />, label: `${selectedProperty.windowCount} fenêtres` });
    }
    if (selectedProperty.frenchDoorCount && selectedProperty.frenchDoorCount > 0) {
      tags.push({ icon: <DoorSliding sx={{ fontSize: 12 }} />, label: `${selectedProperty.frenchDoorCount} portes-fenêtres` });
    }
    if (selectedProperty.slidingDoorCount && selectedProperty.slidingDoorCount > 0) {
      tags.push({ icon: <DoorSliding sx={{ fontSize: 12 }} />, label: `${selectedProperty.slidingDoorCount} baies vitrées` });
    }

    return tags;
  }, [selectedProperty, t]);

  // ── Step validation ─────────────────────────────────────────────────────
  const canGoNext = useCallback(() => {
    if (activeStep === 0) {
      return !!watchedServiceType;
    }
    return true;
  }, [activeStep, watchedServiceType]);

  const handleNext = useCallback(() => {
    if (canGoNext()) {
      setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  }, [canGoNext]);

  const handleBack = useCallback(() => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────
  const onSubmit = useCallback(async (formData: ServiceRequestFormValues) => {
    setSaving(true);
    setError(null);

    try {
      const desiredDate = formData.desiredDate ? new Date(formData.desiredDate).toISOString() : null;

      const backendData: Record<string, string | number | boolean | null> = {
        title: formData.title,
        description: formData.description,
        propertyId,
        reservationId: reservationId ?? null,
        serviceType: formData.serviceType,
        priority: formData.priority,
        estimatedDurationHours: formData.estimatedDurationHours,
        desiredDate,
        userId: formData.userId ?? user?.databaseId ?? null,
        status: 'PENDING',
      };

      if (canAssignForProperty) {
        backendData.assignedToId = formData.assignedToId || null;
        backendData.assignedToType = formData.assignedToType || null;
      }

      const result = await apiClient.post<{ id: number }>('/service-requests', backendData);
      const newId = result?.id;
      setCreatedId(newId || null);
      onCreated?.(newId);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [propertyId, user?.databaseId, canAssignForProperty, onCreated, onClose]);

  const handleConfirm = useCallback(() => {
    rhfHandleSubmit(onSubmit)();
  }, [rhfHandleSubmit, onSubmit]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '85vh' } }}
    >
      {/* ── Title ── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Send sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Nouvelle demande de service
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pt: 0, pb: 0 }}>
        {/* ── Header: Property info + Title + Requestor ── */}
        <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          {/* Property name + address */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <Home sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary' }}>
              {propertyName}
            </Typography>
            {selectedProperty && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                — {selectedProperty.address}, {selectedProperty.city}
              </Typography>
            )}
          </Box>

          {/* Property tags */}
          {propertyTags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {propertyTags.map((tag, idx) => (
                <Chip key={idx} icon={tag.icon} label={tag.label} size="small" variant="outlined" sx={TAG_SX} />
              ))}
            </Box>
          )}

          {/* Title + Requestor row */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {/* Title */}
            <Box sx={{ flex: 7 }}>
              <Controller
                name="title"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    label="Titre de la demande *"
                    placeholder="Ex: Nettoyage après départ"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
                  />
                )}
              />
            </Box>

            {/* Demandeur — lecture seule, trace l'utilisateur connecté */}
            <Box sx={{ flex: 5 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 500, color: 'text.disabled', mb: 0.5, ml: 0.25 }}>
                Demandeur
              </Typography>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.75,
                borderRadius: 1,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200',
                minHeight: 40,
              }}>
                <Person sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.primary', flex: 1 }}>
                  {currentUserLabel}
                </Typography>
                {currentUserRole && (
                  <Chip
                    label={currentUserRole}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.5625rem',
                      fontWeight: 600,
                      bgcolor: isAdmin() ? 'error.50' : isManager() ? 'warning.50' : 'primary.50',
                      color: isAdmin() ? 'error.main' : isManager() ? 'warning.dark' : 'primary.main',
                      borderRadius: 0.75,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Stepper ── */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': { fontSize: '0.75rem', fontWeight: 600 },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ── Step Content ── */}
        {loadingData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ minHeight: 250 }}>
            {/* Step 1: Service */}
            {activeStep === 0 && (
              <>
                <ServiceRequestFormInfo
                  control={control}
                  errors={errors}
                  setValue={setValue}
                  watchedServiceType={watchedServiceType}
                  disabled={false}
                  propertyDescription={selectedProperty?.description}
                  cleaningNotes={selectedProperty?.cleaningNotes}
                  selectedProperty={selectedProperty}
                  includedPrestations={selectedForfait?.includedPrestations}
                  extraPrestations={selectedForfait?.extraPrestations}
                />

                {/* ── Estimation dynamique prix + durée ── */}
                {selectedProperty && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mt: 2,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'primary.100',
                    bgcolor: 'primary.50',
                  }}>
                    {/* Durée estimée */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
                      <Timer sx={{ fontSize: 18, color: 'primary.main' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>
                          Durée estimée
                        </Typography>
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'primary.main', lineHeight: 1.3 }}>
                          {formatDuration(estimatedDuration)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Séparateur */}
                    <Box sx={{ width: 1, height: 28, bgcolor: 'primary.200', borderRadius: 1, flexShrink: 0 }} />

                    {/* Prix estimé */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
                      <Euro sx={{ fontSize: 18, color: 'primary.main' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>
                          Prix estimé
                        </Typography>
                        {priceRange ? (
                          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'primary.main', lineHeight: 1.3 }}>
                            {priceRange.min === priceRange.max
                              ? convertAndFormat(priceRange.min, 'EUR')
                              : `${convertAndFormat(priceRange.min, 'EUR')} – ${convertAndFormat(priceRange.max, 'EUR')}`}
                          </Typography>
                        ) : (
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.disabled', lineHeight: 1.3 }}>
                            Non disponible
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Forfait sélectionné */}
                    {selectedForfait && (
                      <>
                        <Box sx={{ width: 1, height: 28, bgcolor: 'primary.200', borderRadius: 1, flexShrink: 0 }} />
                        <Chip
                          label={selectedForfait.label}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{
                            height: 22,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            borderRadius: 1,
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      </>
                    )}
                  </Box>
                )}
              </>
            )}

            {/* Step 2: Planning */}
            {activeStep === 1 && (
              <ServiceRequestFormPlanning
                control={control}
                errors={errors}
                setValue={setValue}
                disabled={false}
                isAdminOrManager={isAdminOrManager}
                reservations={propertyReservations}
              />
            )}

            {/* Step 3: Assignment */}
            {activeStep === 2 && (
              <Box>
                <ServiceRequestFormAssignment
                  control={control}
                  errors={errors}
                  setValue={setValue}
                  users={users}
                  teams={teams}
                  canAssignForProperty={canAssignForProperty}
                  watchedAssignedToType={watchedAssignedToType}
                  watchedServiceType={watchedServiceType}
                  isEditMode={false}
                  disabled={false}
                  eligibleTeamIds={eligibleTeamIds}
                />

                {/* ── Conflict detection panel ────────────────────────────── */}
                {conflictLoading && (watchedAssignedToType === 'team' || watchedAssignedToType === 'user') && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, py: 0.75 }}>
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {watchedAssignedToType === 'team'
                        ? "Vérification de la disponibilité de l'équipe..."
                        : "Vérification de la disponibilité de l'utilisateur..."}
                    </Typography>
                  </Box>
                )}

                {/* ── Team conflict ── */}
                {!conflictLoading && hasConflict && conflictInfo && watchedAssignedToType === 'team' && (
                  <Alert
                    severity="error"
                    icon={<WarningIcon sx={{ fontSize: 20 }} />}
                    sx={{
                      mt: 1.5,
                      fontSize: '0.75rem',
                      '& .MuiAlert-message': { fontSize: '0.75rem' },
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
                      Conflit de planification détecté
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', mb: 1 }}>
                      L'équipe <strong>{conflictInfo.teamName}</strong> a déjà{' '}
                      {conflictInfo.teamConflictCount > 0
                        ? `${conflictInfo.teamConflictCount} intervention${conflictInfo.teamConflictCount > 1 ? 's' : ''} d'équipe`
                        : 'des membres occupés'}{' '}
                      sur ce créneau. Choisissez une autre équipe ou une autre date.
                    </Typography>
                    {conflictMembers.length > 0 && (
                      <Box sx={{ mt: 0.5, pl: 0.5 }}>
                        {conflictMembers.map((member) => (
                          <Box key={member.userId} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                            <Person sx={{ fontSize: 12, color: member.available ? 'success.main' : 'error.main' }} />
                            <Typography sx={{ fontSize: '0.6875rem' }}>
                              {member.firstName} {member.lastName}
                              {!member.available && (
                                <Typography component="span" sx={{ fontSize: '0.6875rem', color: 'error.main', fontWeight: 600 }}>
                                  {' '}— {member.conflictCount} conflit{member.conflictCount > 1 ? 's' : ''}
                                </Typography>
                              )}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Alert>
                )}

                {!conflictLoading && !hasConflict && conflictInfo && watchedAssignedToType === 'team' && (
                  <Alert
                    severity="success"
                    sx={{ mt: 1.5, fontSize: '0.6875rem', py: 0, '& .MuiAlert-message': { py: 0.5, fontSize: '0.6875rem' } }}
                  >
                    L'équipe <strong>{conflictInfo.teamName}</strong> est disponible sur ce créneau
                  </Alert>
                )}

                {/* ── User conflict ── */}
                {!conflictLoading && hasConflict && userConflictInfo && watchedAssignedToType === 'user' && (
                  <Alert
                    severity="error"
                    icon={<WarningIcon sx={{ fontSize: 20 }} />}
                    sx={{
                      mt: 1.5,
                      fontSize: '0.75rem',
                      '& .MuiAlert-message': { fontSize: '0.75rem' },
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
                      Conflit de planification détecté
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem' }}>
                      <strong>{userConflictInfo.firstName} {userConflictInfo.lastName}</strong> a déjà{' '}
                      {userConflictInfo.conflictCount} intervention{userConflictInfo.conflictCount > 1 ? 's' : ''}{' '}
                      sur ce créneau. Choisissez un autre intervenant ou une autre date.
                    </Typography>
                  </Alert>
                )}

                {!conflictLoading && !hasConflict && userConflictInfo && watchedAssignedToType === 'user' && (
                  <Alert
                    severity="success"
                    sx={{ mt: 1.5, fontSize: '0.6875rem', py: 0, '& .MuiAlert-message': { py: 0.5, fontSize: '0.6875rem' } }}
                  >
                    <strong>{userConflictInfo.firstName} {userConflictInfo.lastName}</strong> est disponible sur ce créneau
                  </Alert>
                )}

                {/* Workflow info */}
                <Alert severity="info" sx={{ fontSize: '0.6875rem', mt: 2, '& .MuiAlert-message': { fontSize: '0.6875rem' } }}>
                  La demande sera soumise au workflow : validation → assignation → paiement → intervention planifiée.
                </Alert>
              </Box>
            )}
          </Box>
        )}

        {/* Error / Success */}
        {error && (
          <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1.5 }}>
            {error}
          </Alert>
        )}

        {createdId && (
          <Alert severity="success" sx={{ fontSize: '0.75rem', mt: 1.5 }}>
            Demande créée.{' '}
            <Link component="button" onClick={() => navigate(`/service-requests/${createdId}`)} sx={{ fontSize: '0.75rem' }}>
              Voir la demande
            </Link>
          </Alert>
        )}
      </DialogContent>

      {/* ── Actions ── */}
      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5, justifyContent: 'space-between' }}>
        <Button onClick={onClose} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
          Annuler
        </Button>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {activeStep > 0 && (
            <Button
              onClick={handleBack}
              size="small"
              startIcon={<ArrowBack sx={{ fontSize: 14 }} />}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Retour
            </Button>
          )}

          {activeStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              variant="contained"
              size="small"
              disabled={!canGoNext()}
              endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Suivant
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              variant="contained"
              size="small"
              disabled={saving || hasConflict || conflictLoading}
              startIcon={saving ? <CircularProgress size={14} /> : hasConflict ? <WarningIcon sx={{ fontSize: 16 }} /> : <Send sx={{ fontSize: 16 }} />}
              color={hasConflict ? 'error' : 'primary'}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {hasConflict ? 'Conflit détecté' : 'Créer la demande'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default CreateServiceRequestDialog;
