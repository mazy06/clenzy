import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  InputBase,
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
  Warning as WarningIcon,
  Timer,
  Euro,
} from '../../../icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import apiClient from '../../../services/apiClient';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { usersApi } from '../../../services/api/usersApi';
import { teamsApi } from '../../../services/api/teamsApi';
import { reservationsApi } from '../../../services/api/reservationsApi';
import { serviceRequestsApi } from '../../../services/api/serviceRequestsApi';
import type { Reservation } from '../../../services/api';
import { interventionsApi } from '../../../services/api/interventionsApi';
import type { TeamMemberAvailability, UserAvailabilityResponse } from '../../../services/api/interventionsApi';
import { pricingConfigApi } from '../../../services/api/pricingConfigApi';
import type { ForfaitConfig, ServicePriceConfig } from '../../../services/api/pricingConfigApi';
import { technicianPrestationsApi } from '../../../services/api/technicianPrestationsApi';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceRequestSchema } from '../../../schemas/serviceRequestSchema';
import type { ServiceRequestFormValues } from '../../../schemas';
import { INTERVENTION_TYPE_OPTIONS } from '../../../types/interventionTypes';
import { computeEstimatedDuration, formatDuration, computeRangeFromForfait } from '../../service-requests/ServiceRequestPriceEstimate';
import { useCurrency } from '../../../hooks/useCurrency';
import { Money } from '../../../components/Money';

// Sub-components from full form
import ServiceRequestFormInfo from '../../service-requests/ServiceRequestFormInfo';
import ServiceRequestFormPlanning from '../../service-requests/ServiceRequestFormPlanning';
import ServiceRequestFormAssignment from '../../service-requests/ServiceRequestFormAssignment';
import ServiceRequestMaintenancePricing from '../../service-requests/ServiceRequestMaintenancePricing';
import type { MaintenancePricingState } from '../../service-requests/ServiceRequestMaintenancePricing';

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
const STEPS = ['Service', 'Chiffrage', 'Planification', 'Assignation'];

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
  /** Édition d'une demande existante : le modal se pré-remplit et enregistre (PUT) au lieu de créer. */
  editingServiceRequestId?: number | null;
  /** Callback after successful creation / édition */
  onCreated?: (serviceRequestId: number) => void;
}

const CreateServiceRequestDialog: React.FC<CreateServiceRequestDialogProps> = ({
  open,
  onClose,
  propertyId,
  propertyName,
  reservationId,
  defaultServiceType,
  defaultDesiredDate,
  editingServiceRequestId,
  onCreated,
}) => {
  const isEditMode = !!editingServiceRequestId;
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
  // Catalogue « travaux » (config tarifaire) : prestations maintenance chiffrées.
  const [travauxConfig, setTravauxConfig] = useState<ServicePriceConfig[]>([]);
  // P2 — ids des techniciens qui proposent les types de prestation du devis.
  const [matchingTechnicianIds, setMatchingTechnicianIds] = useState<number[]>([]);
  const [propertyReservations, setPropertyReservations] = useState<Reservation[]>([]);
  const [canAssignForProperty, setCanAssignForProperty] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  // Édition : DTO complet récupéré au chargement, réutilisé au submit pour ne pas
  // nuller les champs non exposés par le formulaire (accessNotes, urgent, actualCost…).
  // Payload brut de la demande en edition : lu uniquement au submit : ref.
  const editingRawRef = useRef<Record<string, unknown> | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // ── Conflict detection state ────────────────────────────────────────────
  const [conflictMembers, setConflictMembers] = useState<TeamMemberAvailability[]>([]);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{ allAvailable: boolean; teamName: string; teamConflictCount: number } | null>(null);
  const [userConflictInfo, setUserConflictInfo] = useState<UserAvailabilityResponse | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  const isAdminOrManager = isAdmin() || isManager();

  // ── React Hook Form ─────────────────────────────────────────────────────
  const { control, handleSubmit: rhfHandleSubmit, watch, setValue, getValues, reset, formState: { errors } } = useForm<ServiceRequestFormValues>({
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
      estimatedCost: undefined,
      quoteLines: [],
      pricingMode: 'DIRECT',
      diagnosticFee: undefined,
    },
  });

  const watchedServiceType = watch('serviceType');
  const watchedAssignedToType = watch('assignedToType');
  const watchedAssignedToId = watch('assignedToId');
  const watchedDesiredDate = watch('desiredDate');
  const watchedEstimatedDuration = watch('estimatedDurationHours');
  const watchedQuoteLines = watch('quoteLines');
  const watchedPricingMode = watch('pricingMode');
  const watchedDiagnosticFee = watch('diagnosticFee');

  // ── Reset form when dialog opens (création uniquement) ──────────────────
  useEffect(() => {
    if (open && !editingServiceRequestId) {
      setActiveStep(0);
      setError(null);
      setCreatedId(null);
      editingRawRef.current = null;
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
        estimatedCost: undefined,
        quoteLines: [],
        pricingMode: 'DIRECT',
        diagnosticFee: undefined,
      });
    }
  }, [open, defaultServiceType, defaultDesiredDate, propertyId, user?.databaseId, reset, editingServiceRequestId]);

  // ── Pré-remplissage en mode édition ─────────────────────────────────────
  useEffect(() => {
    if (!open || !editingServiceRequestId) return;
    let cancelled = false;
    setActiveStep(0);
    setError(null);
    setCreatedId(null);
    setConflictMembers([]);
    setConflictInfo(null);
    setUserConflictInfo(null);
    setHasConflict(false);
    setLoadingEdit(true);
    serviceRequestsApi.getById(editingServiceRequestId)
      .then((sr) => {
        if (cancelled) return;
        editingRawRef.current = sr as unknown as Record<string, unknown>;
        reset({
          title: sr.title || '',
          description: sr.description || '',
          propertyId,
          serviceType: sr.serviceType || 'CLEANING',
          priority: sr.priority || 'NORMAL',
          estimatedDurationHours: sr.estimatedDurationHours || 1,
          desiredDate: sr.desiredDate ? sr.desiredDate.slice(0, 16) : '',
          userId: sr.userId || user?.databaseId || undefined,
          assignedToId: sr.assignedToId ?? undefined,
          assignedToType: sr.assignedToType ?? undefined,
          status: sr.status,
          estimatedCost: sr.estimatedCost ?? undefined,
          quoteLines: (sr.quoteLines || []).map((l) => ({
            label: l.label,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            interventionType: l.interventionType,
          })),
          pricingMode: sr.pricingMode || 'DIRECT',
          diagnosticFee: sr.diagnosticFee ?? undefined,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement de la demande');
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false);
      });
    return () => { cancelled = true; };
  }, [open, editingServiceRequestId, propertyId, user?.databaseId, reset]);

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
        if (data.travauxConfig) {
          setTravauxConfig(data.travauxConfig.filter((t) => t.enabled));
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

    // La valeur du datetime-local est deja une heure LOCALE au format 'YYYY-MM-DDTHH:mm'
    // (= format attendu par LocalDateTime.parse cote back). Pas de round-trip via Date/toISOString
    // qui re-serialiserait en UTC et verifierait le mauvais creneau (decalage d'heure/de jour).
    const dateStr = watchedDesiredDate;
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
  // « Autre » (OTHER) = type personnalisé : le titre est saisi par l'utilisateur,
  // on ne l'écrase pas.
  useEffect(() => {
    if (!watchedServiceType || watchedServiceType === 'OTHER') return;
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

  // Catalogue des prestations « travaux » (config) présenté comme chips en
  // maintenance : label résolu + prix de base. Un clic ajoute une ligne de devis.
  const workPrestations = useMemo(
    () => travauxConfig.map((t) => ({
      interventionType: t.interventionType,
      label: t.label
        ?? INTERVENTION_TYPE_OPTIONS.find(o => o.value === t.interventionType)?.label
        ?? t.interventionType.replace(/_/g, ' '),
      basePrice: t.basePrice ?? 0,
      domain: t.domain,
    })),
    [travauxConfig],
  );

  // Types de prestation catalogue présents dans le devis (chips surlignés).
  const selectedWorkTypes = useMemo(
    () => (watchedQuoteLines ?? []).map((l) => l.interventionType).filter((t): t is string => !!t),
    [watchedQuoteLines],
  );

  // Toggle d'une prestation du catalogue : ajoute la ligne si absente, la retire
  // si déjà présente (multi-sélection). Bascule en « devis direct », recalcule le
  // total (le serveur reste autoritatif à la création).
  const handleToggleWorkPrestation = useCallback((label: string, unitPrice: number, interventionType?: string) => {
    const current = getValues('quoteLines') ?? [];
    const already = !!interventionType && current.some((l) => l.interventionType === interventionType);
    const next = already
      ? current.filter((l) => l.interventionType !== interventionType)
      : [...current, { label, quantity: 1, unitPrice, interventionType }];
    setValue('pricingMode', 'DIRECT');
    setValue('quoteLines', next);
    const total = next.reduce(
      (sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0) * (Number.isFinite(l.unitPrice) ? l.unitPrice : 0),
      0,
    );
    setValue('estimatedCost', Math.round(total * 100) / 100);
  }, [getValues, setValue]);

  // P2 — clé stable des types de prestation présents dans le devis.
  const quoteTypesKey = useMemo(() => {
    const types = Array.from(new Set(
      (watchedQuoteLines ?? [])
        .map((l) => l.interventionType)
        .filter((t): t is string => !!t),
    ));
    return types.sort().join(',');
  }, [watchedQuoteLines]);

  // P2 — charge les techniciens qui proposent ces types (mise en avant à l'assignation).
  useEffect(() => {
    const types = quoteTypesKey ? quoteTypesKey.split(',') : [];
    if (types.length === 0) {
      setMatchingTechnicianIds([]);
      return;
    }
    let cancelled = false;
    technicianPrestationsApi.offering(types)
      .then((ids) => { if (!cancelled) setMatchingTechnicianIds(ids); })
      .catch(() => { if (!cancelled) setMatchingTechnicianIds([]); });
    return () => { cancelled = true; };
  }, [quoteTypesKey]);

  // P3 — à l'assignation d'un technicien, applique SES prix sur les lignes du
  // devis dont le type correspond (le serveur reste autoritatif à la création).
  useEffect(() => {
    if (watchedAssignedToType !== 'user' || !watchedAssignedToId) return;
    let cancelled = false;
    technicianPrestationsApi.forUser(watchedAssignedToId)
      .then((prestations) => {
        if (cancelled) return;
        const priceByType = new Map<string, number>();
        for (const p of prestations) {
          if (p.enabled && p.basePrice != null && p.interventionType) {
            priceByType.set(p.interventionType, p.basePrice);
          }
        }
        if (priceByType.size === 0) return;
        const current = getValues('quoteLines') ?? [];
        let changed = false;
        const next = current.map((l) => {
          if (l.interventionType && priceByType.has(l.interventionType)) {
            const tp = priceByType.get(l.interventionType)!;
            if (tp !== l.unitPrice) { changed = true; return { ...l, unitPrice: tp }; }
          }
          return l;
        });
        if (changed) {
          setValue('quoteLines', next);
          const total = next.reduce(
            (sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0) * (Number.isFinite(l.unitPrice) ? l.unitPrice : 0),
            0,
          );
          setValue('estimatedCost', Math.round(total * 100) / 100);
        }
      })
      .catch(() => { /* pas de droits ou pas de tarifs : on garde les prix de base */ });
    return () => { cancelled = true; };
  }, [watchedAssignedToType, watchedAssignedToId, getValues, setValue]);

  // Ménage = estimation par forfait (m²/chambres) ; maintenance/autre = devis
  // structuré saisi par l'opérateur. Pilote l'affichage de l'étape « Service ».
  const isCleaningCategory = useMemo(
    () => INTERVENTION_TYPE_OPTIONS.find(o => o.value === watchedServiceType)?.category === 'cleaning',
    [watchedServiceType],
  );

  const handlePricingChange = useCallback((next: MaintenancePricingState) => {
    setValue('pricingMode', next.pricingMode);
    setValue('quoteLines', next.quoteLines);
    setValue('diagnosticFee', next.diagnosticFee);
    setValue('estimatedCost', next.estimatedCost);
  }, [setValue]);

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
      // La valeur du datetime-local est deja une heure LOCALE au format 'YYYY-MM-DDTHH:mm'
      // (= format attendu par LocalDateTime cote back). Pas de round-trip via Date/toISOString
      // qui re-serialiserait en UTC et decalerait l'heure.
      const desiredDate = formData.desiredDate || null;

      // En édition on repart du DTO complet pour préserver les champs non exposés
      // par le formulaire (accessNotes, urgent, actualCost…) et le statut courant.
      const backendData: Record<string, unknown> = {
        ...(isEditMode && editingRawRef.current ? editingRawRef.current : {}),
        title: formData.title,
        description: formData.description,
        propertyId,
        reservationId: reservationId ?? null,
        serviceType: formData.serviceType,
        priority: formData.priority,
        estimatedDurationHours: formData.estimatedDurationHours,
        desiredDate,
        userId: formData.userId ?? user?.databaseId ?? null,
        status: isEditMode ? (formData.status ?? (editingRawRef.current?.status as string | undefined) ?? 'PENDING') : 'PENDING',
      };

      // Chiffrage maintenance : le serveur est autoritatif sur le montant à régler.
      if (!isCleaningCategory) {
        const mode = formData.pricingMode ?? 'DIRECT';
        backendData.pricingMode = mode;
        if (mode === 'DIAGNOSTIC') {
          backendData.diagnosticFee = formData.diagnosticFee ?? null;
          backendData.estimatedCost = formData.diagnosticFee ?? null;
          backendData.quoteLines = [];
        } else {
          backendData.quoteLines = formData.quoteLines ?? [];
          backendData.estimatedCost = formData.estimatedCost ?? null;
          backendData.diagnosticFee = null;
        }
      } else {
        // Bascule vers ménage : purger tout résidu de devis maintenance.
        backendData.pricingMode = null;
        backendData.quoteLines = [];
        backendData.diagnosticFee = null;
      }

      if (canAssignForProperty) {
        backendData.assignedToId = formData.assignedToId || null;
        backendData.assignedToType = formData.assignedToType || null;
      }

      let savedId: number | undefined;
      if (isEditMode && editingServiceRequestId) {
        const updated = await serviceRequestsApi.update(editingServiceRequestId, backendData as never);
        savedId = updated?.id ?? editingServiceRequestId;
      } else {
        const result = await apiClient.post<{ id: number }>('/service-requests', backendData);
        savedId = result?.id;
      }
      setCreatedId(savedId || null);
      onCreated?.(savedId as number);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (isEditMode ? 'Erreur lors de l\'enregistrement' : 'Erreur lors de la création');
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [propertyId, reservationId, user?.databaseId, canAssignForProperty, isCleaningCategory, isEditMode, editingServiceRequestId, onCreated, onClose]);

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
      PaperProps={{ sx: { maxHeight: '85vh' } }}
    >
      {/* ── Title ── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1, pt: 2, px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Send size={20} strokeWidth={1.75} /></Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {isEditMode ? 'Modifier l\'intervention' : 'Nouvelle intervention'}
          </Typography>
        </Box>
        {/* Stepper à droite, sur la même ligne que le titre */}
        <Stepper
          activeStep={activeStep}
          sx={{
            ml: 'auto',
            flex: '0 1 480px',
            minWidth: 0,
            '& .MuiStepLabel-label': { fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' },
            '& .MuiStep-root': { px: 0.5 },
          }}
        >
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <IconButton size="small" onClick={onClose} sx={{ flexShrink: 0 }}>
          <Close size={18} strokeWidth={1.75} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pt: 0, pb: 0 }}>
        {/* ── Header: Property info + Title + Requestor ── */}
        <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid var(--line)' }}>
          {/* Property name + address */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Home size={16} strokeWidth={1.75} /></Box>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
              {propertyName}
            </Typography>
            {selectedProperty && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                — {selectedProperty.address}, {selectedProperty.city}
              </Typography>
            )}
          </Box>

          {/* Title + Requestor row */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {/* Title — aligné visuellement sur le bloc « Demandeur » (libellé
                majuscule au-dessus + champ encadré). */}
            <Box sx={{ flex: 7 }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, ml: 0.25 }}>
                Titre de la demande *
              </Typography>
              <Controller
                name="title"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: '11px',
                      bgcolor: 'var(--field)',
                      border: `1px solid ${fieldState.error ? 'var(--err)' : 'var(--field-line)'}`,
                      minHeight: 40,
                    }}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Send size={16} strokeWidth={1.75} /></Box>
                      <InputBase
                        {...field}
                        fullWidth
                        placeholder="Ex: Détartrage ballon d'eau chaude"
                        sx={{ fontSize: '0.8125rem', color: 'var(--ink)', '& input::placeholder': { color: 'var(--faint)', opacity: 1 } }}
                      />
                    </Box>
                    {fieldState.error && (
                      <Typography sx={{ fontSize: '0.6875rem', color: 'var(--err)', mt: 0.25, ml: 0.25 }}>
                        {fieldState.error.message}
                      </Typography>
                    )}
                  </>
                )}
              />
            </Box>

            {/* Demandeur — lecture seule, trace l'utilisateur connecté */}
            <Box sx={{ flex: 5 }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, ml: 0.25 }}>
                Demandeur
              </Typography>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.75,
                borderRadius: '11px',
                bgcolor: 'var(--field)',
                border: '1px solid var(--field-line)',
                minHeight: 40,
              }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Person size={16} strokeWidth={1.75} /></Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink)', flex: 1 }}>
                  {currentUserLabel}
                </Typography>
                {currentUserRole && (
                  <Chip
                    label={currentUserRole}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '10.5px',
                      fontWeight: 700,
                      bgcolor: isAdmin() ? 'var(--err-soft)' : isManager() ? 'var(--warn-soft)' : 'var(--accent-soft)',
                      color: isAdmin() ? 'var(--err)' : isManager() ? 'var(--warn)' : 'var(--accent)',
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Box>

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
                cleaningNotes={selectedProperty?.cleaningNotes}
                selectedProperty={selectedProperty}
                includedPrestations={selectedForfait?.includedPrestations}
                extraPrestations={selectedForfait?.extraPrestations}
                workPrestations={workPrestations}
                selectedWorkTypes={selectedWorkTypes}
                onToggleWorkPrestation={handleToggleWorkPrestation}
                framed
              />
            )}

            {/* Step 2: Chiffrage */}
            {activeStep === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* Chiffrage ménage : estimation forfait (durée + prix), en colonne */}
                    {selectedProperty && isCleaningCategory && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, px: 1.5, py: 1.25, borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', bgcolor: 'var(--accent-soft)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Timer size={18} strokeWidth={1.75} /></Box>
                          <Box>
                            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Durée estimée</Typography>
                            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--accent)', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(estimatedDuration)}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Euro size={18} strokeWidth={1.75} /></Box>
                          <Box>
                            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Prix estimé</Typography>
                            {priceRange ? (
                              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--accent)', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
                                {priceRange.min === priceRange.max ? <Money value={priceRange.min} from="EUR" /> : `${convertAndFormat(priceRange.min, 'EUR')} – ${convertAndFormat(priceRange.max, 'EUR')}`}
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--faint)', lineHeight: 1.3 }}>Non disponible</Typography>
                            )}
                          </Box>
                        </Box>
                        {selectedForfait && (
                          <Chip label={selectedForfait.label} size="small" variant="outlined" sx={{ alignSelf: 'flex-start', height: 22, fontSize: '0.625rem', fontWeight: 600, color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--card)', '& .MuiChip-label': { px: 1 } }} />
                        )}
                      </Box>
                    )}
                    {/* Chiffrage maintenance : devis direct ou diagnostic préalable */}
                    {!isCleaningCategory && (
                      <ServiceRequestMaintenancePricing
                        pricingMode={watchedPricingMode ?? 'DIRECT'}
                        quoteLines={watchedQuoteLines ?? []}
                        diagnosticFee={watchedDiagnosticFee}
                        onChange={handlePricingChange}
                      />
                    )}
              </Box>
            )}

            {/* Step 3: Planning */}
            {activeStep === 2 && (
              <ServiceRequestFormPlanning
                control={control}
                errors={errors}
                setValue={setValue}
                disabled={false}
                isAdminOrManager={isAdminOrManager}
                reservations={propertyReservations}
              />
            )}

            {/* Step 4: Assignment */}
            {activeStep === 3 && (
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
                  matchingUserIds={matchingTechnicianIds}
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
                    icon={<WarningIcon size={20} strokeWidth={1.75} />}
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
                            <Box component="span" sx={{ display: 'inline-flex', color: member.available ? 'var(--ok)' : 'var(--err)' }}><Person size={12} strokeWidth={1.75} /></Box>
                            <Typography sx={{ fontSize: '0.6875rem' }}>
                              {member.firstName} {member.lastName}
                              {!member.available && (
                                <Typography component="span" sx={{ fontSize: '0.6875rem', color: 'var(--err)', fontWeight: 600 }}>
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
                    icon={<WarningIcon size={20} strokeWidth={1.75} />}
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
              startIcon={<ArrowBack size={14} strokeWidth={1.75} />}
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
              endIcon={<ArrowForward size={14} strokeWidth={1.75} />}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Suivant
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              variant="contained"
              size="small"
              disabled={saving || hasConflict || conflictLoading || loadingEdit}
              startIcon={saving ? <CircularProgress size={14} /> : hasConflict ? <WarningIcon size={16} strokeWidth={1.75} /> : <Send size={16} strokeWidth={1.75} />}
              color={hasConflict ? 'error' : 'primary'}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {hasConflict ? 'Conflit détecté' : isEditMode ? 'Enregistrer' : 'Créer la demande'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default CreateServiceRequestDialog;
