import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, propertiesApi } from '../../services/api';
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

export function useInterventionState(id: string | undefined) {
  const { user, hasPermissionAsync, isTechnician, isHousekeeper, isSupervisor } = useAuth();

  // Core state
  const [intervention, setIntervention] = useState<InterventionDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Property details for room counts
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);

  // Permission states
  const [canViewInterventions, setCanViewInterventions] = useState(false);
  const [canEditInterventions, setCanEditInterventions] = useState(false);

  // Initial load data passed to sibling hooks — set once after the fetch
  const [initialLoadData, setInitialLoadData] = useState<InitialLoadData | null>(null);

  // ------------------------------------------------------------------
  // Permission checks
  // ------------------------------------------------------------------

  useEffect(() => {
    const checkPermissions = async () => {
      const canView = await hasPermissionAsync('interventions:view');
      setCanViewInterventions(canView);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  useEffect(() => {
    const checkPermissions = async () => {
      const canEdit = await hasPermissionAsync('interventions:edit');
      setCanEditInterventions(canEdit);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ------------------------------------------------------------------
  // Computed permission helpers
  // ------------------------------------------------------------------

  const canStartOrUpdateIntervention = (): boolean => {
    if (!intervention) return false;
    const isOperationalUser = isTechnician() || isHousekeeper() || isSupervisor();
    if (!isOperationalUser) return false;
    return intervention.assignedToId !== undefined && intervention.assignedToId !== null;
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
      return String(user?.id) === String(intervention.assignedToId);
    }
    return false;
  };

  // ------------------------------------------------------------------
  // Action handlers
  // ------------------------------------------------------------------

  const handleStartIntervention = async () => {
    if (!id || !intervention) return;
    setStarting(true);
    try {
      const updated = await interventionsApi.start(Number(id)) as unknown as InterventionDetailsData;
      setIntervention(updated);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du d\u00e9marrage de l\'intervention');
    } finally {
      setStarting(false);
    }
  };

  const handleCompleteIntervention = async () => {
    if (!id || !intervention) return;
    setCompleting(true);
    try {
      const updated = await interventionsApi.updateProgress(Number(id), 100) as unknown as InterventionDetailsData;
      setIntervention(updated);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la finalisation de l\'intervention');
    } finally {
      setCompleting(false);
    }
  };

  // ------------------------------------------------------------------
  // Load intervention + property data
  // ------------------------------------------------------------------

  useEffect(() => {
    const loadIntervention = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        const data = await interventionsApi.getById(Number(id)) as unknown as InterventionDetailsData;
        setIntervention(data);

        // ---- Property details ----
        let loadedPropertyDetails: PropertyDetails | null = null;
        let computedAllRoomsValidated = false;
        const computedCompletedSteps = new Set<string>();
        let computedInspectionComplete = false;

        if (data.propertyId) {
          try {
            const rawProperty = await propertiesApi.getById(data.propertyId);
            loadedPropertyDetails = {
              bedroomCount: rawProperty.bedroomCount,
              bathroomCount: rawProperty.bathroomCount,
              bedrooms: rawProperty.bedroomCount,
              bathrooms: rawProperty.bathroomCount,
            };
            setPropertyDetails(loadedPropertyDetails);

            if (data.validatedRooms) {
              try {
                const parsedRooms = JSON.parse(data.validatedRooms);
                if (Array.isArray(parsedRooms)) {
                  const totalRooms = (loadedPropertyDetails.bedrooms || 0) +
                    (loadedPropertyDetails.bathrooms || 0) +
                    (loadedPropertyDetails.livingRooms || 0) +
                    (loadedPropertyDetails.kitchens || 0);
                  if (parsedRooms.length === totalRooms && totalRooms > 0) {
                    computedAllRoomsValidated = true;
                    computedCompletedSteps.add('rooms');
                  }
                }
              } catch {
                // silent
              }
            }
          } catch {
            // silent
          }
        }

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
                const totalRooms = (loadedPropertyDetails.bedrooms || 0) +
                  (loadedPropertyDetails.bathrooms || 0) +
                  (loadedPropertyDetails.livingRooms || 0) +
                  (loadedPropertyDetails.kitchens || 0);
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

        // Publish initial load data for sibling hooks
        setInitialLoadData({
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
        });
      } catch {
        setError('Erreur lors du chargement de l\'intervention');
      } finally {
        setLoading(false);
      }
    };

    loadIntervention();
  }, [id]);

  return {
    // Auth-derived
    user,
    isTechnician,
    isHousekeeper,
    isSupervisor,

    // Core state
    intervention,
    setIntervention,
    loading,
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

    // Computed helpers
    canStartOrUpdateIntervention,
    canStartIntervention,
    canUpdateProgress,
    canModifyIntervention,

    // Actions
    handleStartIntervention,
    handleCompleteIntervention,

    // Initial load data for sibling hooks
    initialLoadData,
  };
}
