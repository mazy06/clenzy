import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, propertiesApi } from '../../services/api';
import { interventionsKeys } from './useInterventionsList';
import {
  InterventionDetailsData,
  PropertyDetails,
  StepNotes,
  parsePhotos
} from './interventionUtils';

/**
 * Loaded data produced by the initial fetch, consumed by sibling hooks
 * to hydrate their own state without re-fetching.
 */
export interface InitialLoadData {
  intervention: InterventionDetailsData;
  propertyDetails: PropertyDetails | null;
  beforePhotos: string[];
  afterPhotos: string[];
  completedSteps: Set<string>;
  inspectionComplete: boolean;
  validatedRooms: Set<number>;
  allRoomsValidated: boolean;
  stepNotes: StepNotes;
  lastSavedNotes: string;
}

// ─── Query keys for detail view ──────────────────────────────────────────────

const detailKeys = {
  property: (interventionId: string) => [...interventionsKeys.detail(interventionId), 'property'] as const,
};

export function useInterventionState(id: string | undefined) {
  const { user, hasPermissionAsync, isTechnician, isHousekeeper, isSupervisor } = useAuth();
  const queryClient = useQueryClient();

  // UI-only state
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local intervention state (updated by mutations in child hooks)
  const [intervention, setIntervention] = useState<InterventionDetailsData | null>(null);

  // Permission states
  const [canViewInterventions, setCanViewInterventions] = useState(false);
  const [canEditInterventions, setCanEditInterventions] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // ------------------------------------------------------------------
  // Permission checks
  // ------------------------------------------------------------------

  useEffect(() => {
    const checkPermissions = async () => {
      const [canView, canEdit] = await Promise.all([
        hasPermissionAsync('interventions:view'),
        hasPermissionAsync('interventions:edit'),
      ]);
      setCanViewInterventions(canView);
      setCanEditInterventions(canEdit);
      setPermissionsLoaded(true);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ------------------------------------------------------------------
  // React Query: load intervention
  // ------------------------------------------------------------------

  const interventionQuery = useQuery({
    queryKey: interventionsKeys.detail(id ?? ''),
    queryFn: () => interventionsApi.getById(Number(id)) as unknown as Promise<InterventionDetailsData>,
    enabled: !!id,
    staleTime: 30_000,
  });

  // Sync query data → local state
  useEffect(() => {
    if (interventionQuery.data) {
      setIntervention(interventionQuery.data);
    }
  }, [interventionQuery.data]);

  useEffect(() => {
    if (interventionQuery.error) {
      setError('Erreur lors du chargement de l\'intervention');
    }
  }, [interventionQuery.error]);

  // ------------------------------------------------------------------
  // React Query: load property details
  // ------------------------------------------------------------------

  const propertyQuery = useQuery({
    queryKey: detailKeys.property(id ?? ''),
    queryFn: async (): Promise<PropertyDetails | null> => {
      if (!interventionQuery.data?.propertyId) return null;
      try {
        const rawProperty = await propertiesApi.getById(interventionQuery.data.propertyId);
        return {
          bedroomCount: rawProperty.bedroomCount,
          bathroomCount: rawProperty.bathroomCount,
          bedrooms: rawProperty.bedroomCount,
          bathrooms: rawProperty.bathroomCount,
        };
      } catch {
        return null;
      }
    },
    enabled: !!interventionQuery.data?.propertyId,
    staleTime: 60_000,
  });

  const propertyDetails = propertyQuery.data ?? null;

  // ------------------------------------------------------------------
  // Derived initial load data for sibling hooks (memoized)
  // ------------------------------------------------------------------

  const initialLoadData = useMemo<InitialLoadData | null>(() => {
    const data = interventionQuery.data;
    if (!data) return null;

    const loadedPropertyDetails = propertyDetails;
    const computedCompletedSteps = new Set<string>();
    let computedInspectionComplete = false;
    let computedAllRoomsValidated = false;

    // ---- Completed steps from DB ----
    if (data.completedSteps) {
      try {
        const parsedSteps = JSON.parse(data.completedSteps);
        if (Array.isArray(parsedSteps)) {
          parsedSteps.forEach((s: string) => computedCompletedSteps.add(s));
          if (parsedSteps.includes('inspection')) {
            computedInspectionComplete = true;
          }
        }
      } catch {
        // silent
      }
    }

    // ---- Before photos ----
    let loadedBeforePhotos: string[] = [];
    if (data.beforePhotosUrls) {
      loadedBeforePhotos = parsePhotos(data.beforePhotosUrls);
      if (loadedBeforePhotos.length > 0) {
        computedInspectionComplete = true;
        computedCompletedSteps.add('inspection');
      }
    }

    // ---- After photos ----
    let loadedAfterPhotos: string[] = [];
    if (data.afterPhotosUrls) {
      loadedAfterPhotos = parsePhotos(data.afterPhotosUrls);
      if (loadedAfterPhotos.length > 0) {
        computedCompletedSteps.add('after_photos');
      }
    }

    // ---- Notes ----
    let loadedStepNotes: StepNotes = {};
    let lastSavedNotes = '';
    if (data.notes) {
      try {
        const parsedNotes = JSON.parse(data.notes);
        if (typeof parsedNotes === 'object' && parsedNotes !== null) {
          loadedStepNotes = parsedNotes;
          lastSavedNotes = data.notes;
        } else {
          loadedStepNotes = { inspection: data.notes };
          lastSavedNotes = JSON.stringify(loadedStepNotes);
        }
      } catch {
        loadedStepNotes = { inspection: data.notes };
        lastSavedNotes = JSON.stringify(loadedStepNotes);
      }
    }

    // ---- Validated rooms ----
    let loadedValidatedRooms = new Set<number>();
    if (data.validatedRooms) {
      try {
        const parsedRooms = JSON.parse(data.validatedRooms);
        if (Array.isArray(parsedRooms)) {
          loadedValidatedRooms = new Set(parsedRooms);
          if (loadedPropertyDetails) {
            const totalRooms = (loadedPropertyDetails.bedroomCount || 0) +
              (loadedPropertyDetails.bathroomCount || 0) +
              (loadedPropertyDetails.livingRooms || 1) +
              (loadedPropertyDetails.kitchens || 1);
            if (parsedRooms.length === totalRooms && totalRooms > 0) {
              computedAllRoomsValidated = true;
              computedCompletedSteps.add('rooms');
            }
          }
        }
      } catch {
        // silent
      }
    }

    return {
      intervention: data,
      propertyDetails: loadedPropertyDetails,
      beforePhotos: loadedBeforePhotos,
      afterPhotos: loadedAfterPhotos,
      completedSteps: computedCompletedSteps,
      inspectionComplete: computedInspectionComplete,
      validatedRooms: loadedValidatedRooms,
      allRoomsValidated: computedAllRoomsValidated,
      stepNotes: loadedStepNotes,
      lastSavedNotes,
    };
  }, [interventionQuery.data, propertyDetails]);

  // ------------------------------------------------------------------
  // Computed permission helpers
  // ------------------------------------------------------------------

  const canStartOrUpdateIntervention = (): boolean => {
    if (!intervention) return false;
    const isOperationalUser = isTechnician() || isHousekeeper() || isSupervisor();
    if (!isOperationalUser) return false;
    if (intervention.assignedToId === undefined || intervention.assignedToId === null) return false;
    // Vérifier que le user connecté est bien l'assigné (ou membre de l'équipe assignée)
    if (intervention.assignedToType === 'user') {
      return user?.databaseId === intervention.assignedToId;
    }
    // assignedToType === 'team' : tout membre opérationnel de l'org peut agir
    return true;
  };

  const canStartIntervention = (): boolean => {
    if (!intervention) return false;
    return canStartOrUpdateIntervention() && intervention.status === 'PENDING';
  };

  const canUpdateProgress = (): boolean => {
    if (!intervention) return false;
    return canStartOrUpdateIntervention() && intervention.status === 'IN_PROGRESS';
  };

  const canModifyIntervention = (): boolean => {
    if (canEditInterventions) return true;
    if (!intervention) return false;
    if (intervention.assignedToType === 'team') return true;
    if (intervention.assignedToType === 'user') {
      return user?.databaseId === intervention.assignedToId;
    }
    return false;
  };

  // ------------------------------------------------------------------
  // Mutations: start & complete
  // ------------------------------------------------------------------

  const [startSuccessMessage, setStartSuccessMessage] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => interventionsApi.start(Number(id)) as unknown as Promise<InterventionDetailsData>,
    onSuccess: (updated) => {
      setIntervention(updated);
      setError(null);
      setStartSuccessMessage('Intervention démarrée ! Un bon d\'intervention a été généré et envoyé par email.');
      queryClient.invalidateQueries({ queryKey: interventionsKeys.all });
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors du démarrage de l\'intervention');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => interventionsApi.updateProgress(Number(id), 100) as unknown as Promise<InterventionDetailsData>,
    onSuccess: (updated) => {
      setIntervention(updated);
      setError(null);
      queryClient.invalidateQueries({ queryKey: interventionsKeys.all });
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la finalisation de l\'intervention');
    },
  });

  const handleStartIntervention = async () => {
    if (!id || !intervention) return;
    setStarting(true);
    startMutation.mutate(undefined, {
      onSettled: () => setStarting(false),
    });
  };

  const handleCompleteIntervention = async () => {
    if (!id || !intervention) return;
    setCompleting(true);
    completeMutation.mutate(undefined, {
      onSettled: () => setCompleting(false),
    });
  };

  return {
    // Auth-derived
    user,
    isTechnician,
    isHousekeeper,
    isSupervisor,

    // Core state
    intervention,
    setIntervention,
    loading: interventionQuery.isLoading,
    error,
    setError,
    starting,
    completing,
    setCompleting,
    showSidebar,
    setShowSidebar,

    // Property
    propertyDetails,

    // Permissions
    canViewInterventions,
    canEditInterventions,
    permissionsLoaded,

    // Computed helpers
    canStartOrUpdateIntervention,
    canStartIntervention,
    canUpdateProgress,
    canModifyIntervention,

    // Actions
    handleStartIntervention,
    handleCompleteIntervention,

    // Success feedback
    startSuccessMessage,
    setStartSuccessMessage,

    // Initial load data for sibling hooks
    initialLoadData,
  };
}
