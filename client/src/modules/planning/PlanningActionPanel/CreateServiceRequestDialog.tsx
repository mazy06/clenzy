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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import apiClient from '../../../services/apiClient';
import { propertiesApi, usersApi, teamsApi, reservationsApi } from '../../../services/api';
import type { Reservation } from '../../../services/api';
import { pricingConfigApi } from '../../../services/api/pricingConfigApi';
import type { ForfaitConfig } from '../../../services/api/pricingConfigApi';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceRequestSchema } from '../../../schemas';
import type { ServiceRequestFormValues } from '../../../schemas';
import { INTERVENTION_TYPE_OPTIONS } from '../../../types/interventionTypes';
import { getPropertyTypeLabel } from '../../../utils/statusUtils';

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
  defaultServiceType,
  defaultDesiredDate,
  onCreated,
}) => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();

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

  // ── Reset form when dialog opens ────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setError(null);
      setCreatedId(null);

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

  // ── Auto-fill owner as requestor ────────────────────────────────────────
  useEffect(() => {
    if (!selectedProperty?.ownerId || users.length === 0) return;
    const owner = users.find(u => u.id.toString() === selectedProperty.ownerId?.toString());
    if (owner) {
      setValue('userId', owner.id);
    }
  }, [selectedProperty, users, setValue]);

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

            {/* Requestor */}
            <Box sx={{ flex: 5 }}>
              <Controller
                name="userId"
                control={control}
                render={({ field }) => {
                  const selectedUser = users.find(u => u.id === field.value);
                  const hasValue = !!selectedUser;
                  return (
                    <FormControl fullWidth>
                      <InputLabel shrink sx={{ color: 'text.secondary' }}>
                        Demandeur
                      </InputLabel>
                      <Select
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        label="Demandeur"
                        disabled={!isAdminOrManager}
                        size="small"
                        displayEmpty
                        notched
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.200' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light' },
                        }}
                        renderValue={() => (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Person sx={{ fontSize: 16, color: hasValue ? 'primary.main' : 'grey.400' }} />
                            <Typography sx={{ fontSize: '0.8125rem', color: hasValue ? 'text.secondary' : 'grey.400' }}>
                              {hasValue ? `${selectedUser.firstName} ${selectedUser.lastName}` : 'Sélectionner...'}
                            </Typography>
                          </Box>
                        )}
                      >
                        {users.map(u => (
                          <MenuItem key={u.id} value={u.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Person sx={{ fontSize: 16, color: 'primary.main' }} />
                              <Typography sx={{ fontSize: '0.8125rem' }}>{u.firstName} {u.lastName}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                }}
              />
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
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} /> : <Send sx={{ fontSize: 16 }} />}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Créer la demande
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default CreateServiceRequestDialog;
