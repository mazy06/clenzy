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
import { useTranslation } from '../../hooks/useTranslation';
import { documentKeys } from '../documents/hooks/useDocuments';

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
  const { t } = useTranslation();
  const { user, hasPermissionAsync, isTechnician, isHousekeeper, isSupervisor } = useAuth();
  const queryClient = useQueryClient();

  // UI-only state
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
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
    queryFn: () => interventionsApi.getById(Number(id)),
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
      setError(t('interventions.detailErrors.loading'));
    }
  }, [interventionQuery.error, t]);

  // ------------------------------------------------------------------
  // React Query: load property details
  // ------------------------------------------------------------------

  const propertyQuery = useQuery({
    queryKey: detailKeys.property(id ?? ''),
    queryFn: async (): Promise<PropertyDetails | null> => {
      if (!interventionQuery.data?.propertyId) return null;
      const rawProperty = await propertiesApi.getById(interventionQuery.data.propertyId);
      return {
        bedroomCount: rawProperty.bedroomCount,
        bathroomCount: rawProperty.bathroomCount,
      };
    },
    retry: 1,
    enabled: !!interventionQuery.data?.propertyId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (propertyQuery.error) {
      setError(t('interventions.detailErrors.loadingProperty'));
    }
  }, [propertyQuery.error, t]);

  const propertyDetails = useMemo<PropertyDetails | null>(() => {
    if (!propertyQuery.data) return null;
    return {
      bedroomCount: propertyQuery.data.bedroomCount,
      bathroomCount: propertyQuery.data.bathroomCount,
    };
  }, [propertyQuery.data?.bedroomCount, propertyQuery.data?.bathroomCount]);

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
    // On ne re-derive PAS 'after_photos' a partir de afterPhotosUrls.
    // Seul le completedSteps persiste cote serveur fait foi.
    // Sinon lors d'un reopen (qui retire 'after_photos' des completedSteps
    // mais conserve les URLs), la re-hydratation re-ajouterait le step
    // et la progression recalculerait a 100% → auto-completion.
    let loadedAfterPhotos: string[] = [];
    if (data.afterPhotosUrls) {
      loadedAfterPhotos = parsePhotos(data.afterPhotosUrls);
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
              (loadedPropertyDetails.livingRooms ?? 1) +
              (loadedPropertyDetails.kitchens ?? 1);
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

  const canStartOrUpdateIntervention = useMemo(() => {
    if (!intervention) return false;
    const isOperationalUser = isTechnician() || isHousekeeper() || isSupervisor();
    if (!isOperationalUser) return false;
    if (intervention.assignedToId === undefined || intervention.assignedToId === null) return false;
    if (intervention.assignedToType === 'user') {
      return user?.databaseId === intervention.assignedToId;
    }
    return true;
  }, [intervention, user?.databaseId, isTechnician, isHousekeeper, isSupervisor]);

  const canStartIntervention = useMemo(() => {
    if (!intervention) return false;
    return canStartOrUpdateIntervention && intervention.status === 'PENDING';
  }, [intervention, canStartOrUpdateIntervention]);

  const canUpdateProgress = useMemo(() => {
    if (!intervention) return false;
    return canStartOrUpdateIntervention && intervention.status === 'IN_PROGRESS';
  }, [intervention, canStartOrUpdateIntervention]);

  const canModifyIntervention = useMemo(() => {
    if (canEditInterventions) return true;
    if (!intervention) return false;
    if (intervention.assignedToType === 'user') {
      return user?.databaseId === intervention.assignedToId;
    }
    if (intervention.assignedToType === 'team') {
      return isTechnician() || isHousekeeper() || isSupervisor();
    }
    return false;
  }, [canEditInterventions, intervention, user?.databaseId, isTechnician, isHousekeeper, isSupervisor]);

  // ------------------------------------------------------------------
  // Mutations: start & complete
  // ------------------------------------------------------------------

  const [startSuccessMessage, setStartSuccessMessage] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => interventionsApi.start(Number(id)),
    onSuccess: (updated) => {
      setIntervention(updated);
      if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
      setError(null);
      setStartSuccessMessage(t('interventions.detailErrors.startSuccess'));
      queryClient.invalidateQueries({ queryKey: interventionsKeys.lists() });
    },
    onError: (err: Error) => {
      setError(err.message || t('interventions.detailErrors.starting'));
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => interventionsApi.complete(Number(id)),
    onSuccess: (updated) => {
      setIntervention(updated);
      if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
      setError(null);
      queryClient.invalidateQueries({ queryKey: interventionsKeys.lists() });
      // Documents are generated asynchronously via Kafka (~2-3s).
      // Invalidate the document query after a delay so the recap shows them.
      if (id) {
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: documentKeys.generationsByReference('INTERVENTION', Number(id)),
          });
        }, 4000);
        // Second attempt in case Kafka was slower
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: documentKeys.generationsByReference('INTERVENTION', Number(id)),
          });
        }, 8000);
      }
    },
    onError: (err: Error) => {
      setError(err.message || t('interventions.detailErrors.completing'));
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
