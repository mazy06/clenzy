import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { marketplaceProvidersApi } from '../services/api/marketplaceProvidersApi';
import type {
  EngagementMode,
  ExposureEffect,
  ProviderDocumentStatus,
  ProviderSearchParams,
  ProviderStatus,
  ProviderProvisioningState,
} from '../services/api/marketplaceProvidersApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const marketplaceKeys = {
  all: ['marketplace-providers'] as const,
  list: (params: ProviderSearchParams) => [...marketplaceKeys.all, 'list', params] as const,
  detail: (id: number) => [...marketplaceKeys.all, 'detail', id] as const,
  categories: () => [...marketplaceKeys.all, 'categories'] as const,
  cities: () => [...marketplaceKeys.all, 'cities'] as const,
  stats: () => [...marketplaceKeys.all, 'stats'] as const,
  facets: () => [...marketplaceKeys.all, 'facets'] as const,
  documents: (id: number) => [...marketplaceKeys.all, 'documents', id] as const,
  exposure: (id: number) => [...marketplaceKeys.all, 'exposure', id] as const,
  provisioning: (id: number) => [...marketplaceKeys.all, 'provisioning', id] as const,
  invitation: (id: number) => [...marketplaceKeys.all, 'invitation', id] as const,
};

export function useProviderInvitation(id: number) {
  return useQuery({
    queryKey: marketplaceKeys.invitation(id),
    queryFn: () => marketplaceProvidersApi.getInvitation(id),
    refetchInterval: 30_000,
  });
}

export function useProviderProvisioning(id: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: marketplaceKeys.provisioning(id),
    queryFn: async () => {
      const state = await marketplaceProvidersApi.getProvisioning(id);
      const previous = queryClient.getQueryData<ProviderProvisioningState | null>(marketplaceKeys.provisioning(id));
      if (state?.status === 'SUCCEEDED' && previous?.status !== 'SUCCEEDED') {
        void queryClient.invalidateQueries({ queryKey: marketplaceKeys.detail(id) });
      }
      return state;
    },
    refetchInterval: 30_000,
  });
}

export function useRetryProviderProvisioning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => marketplaceProvidersApi.retryProvisioning(id),
    // A conflict means another operator or worker may already have changed the job.
    onSettled: () => queryClient.invalidateQueries({ queryKey: marketplaceKeys.all }),
  });
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Page de resultats du catalogue.
 *
 * `placeholderData` garde la page precedente affichee pendant qu'une nouvelle
 * arrive : sans elle, chaque frappe dans la recherche vide la grille puis la
 * remplit, et la page saute a chaque caractere.
 */
export function useMarketplaceProviders(params: ProviderSearchParams) {
  return useQuery({
    queryKey: marketplaceKeys.list(params),
    queryFn: () => marketplaceProvidersApi.search(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useMarketplaceProvider(id: number | undefined) {
  return useQuery({
    queryKey: marketplaceKeys.detail(id as number),
    queryFn: () => marketplaceProvidersApi.getById(id as number),
    enabled: id !== undefined && Number.isFinite(id),
    staleTime: 30_000,
  });
}

/** Referentiel des metiers. Stable : il ne bouge qu'a l'ajout d'une categorie. */
export function useMarketplaceCategories() {
  return useQuery({
    queryKey: marketplaceKeys.categories(),
    queryFn: () => marketplaceProvidersApi.getCategories(),
    staleTime: 30 * 60_000,
  });
}

export function useMarketplaceCities() {
  return useQuery({
    queryKey: marketplaceKeys.cities(),
    queryFn: () => marketplaceProvidersApi.getCities(),
    staleTime: 10 * 60_000,
  });
}

/**
 * Volumes du catalogue par dimension de filtre.
 *
 * Fraîcheur longue : ces chiffres décrivent la forme du catalogue, pas l'état
 * d'une recherche. Les recalculer à chaque frappe les ferait clignoter sans rien
 * apprendre.
 */
export function useMarketplaceFacets() {
  return useQuery({
    queryKey: marketplaceKeys.facets(),
    queryFn: () => marketplaceProvidersApi.getFacets(),
    staleTime: 5 * 60_000,
  });
}

export function useMarketplaceStats() {
  return useQuery({
    queryKey: marketplaceKeys.stats(),
    queryFn: () => marketplaceProvidersApi.getStats(),
    staleTime: 30_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Changement d'etat d'une fiche.
 *
 * Invalide la racine : un changement de statut deplace la fiche d'un compteur a
 * l'autre et peut la faire sortir de la page filtree en cours. N'invalider que
 * le detail laisserait la liste et les compteurs mentir.
 */
export function useUpdateProviderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reviewNote, decisionMessage }: {
      id: number;
      status: ProviderStatus;
      reviewNote?: string;
      decisionMessage?: string;
    }) => marketplaceProvidersApi.updateStatus(id, status, reviewNote, decisionMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.all });
    },
  });
}

/**
 * Reprise des comptes prestataires existants.
 *
 * Invalide la racine : l'import cree des fiches, deplace les compteurs et fait
 * tomber le bandeau « N comptes absents ». N'invalider que la liste laisserait
 * ce bandeau afficher un chiffre deja traite.
 */
export function useImportExistingProviders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (engagement?: EngagementMode) =>
      marketplaceProvidersApi.importExisting(engagement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.all });
    },
  });
}

/** Justificatifs d'une candidature. Vide tant que rien n'a été déposé. */
export function useProviderDocuments(id: number | undefined) {
  return useQuery({
    queryKey: marketplaceKeys.documents(id as number),
    queryFn: () => marketplaceProvidersApi.getDocuments(id as number),
    enabled: id != null,
  });
}

export function useReviewProviderDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentId, status, reviewNote }: {
      id: number;
      documentId: number;
      status: ProviderDocumentStatus;
      reviewNote?: string;
    }) => marketplaceProvidersApi.reviewDocument(id, documentId, status, reviewNote),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.documents(variables.id) });
    },
  });
}

/** Exceptions de visibilité posées sur une fiche. Vide = visible de tous. */
export function useProviderExposureRules(id: number | undefined) {
  return useQuery({
    queryKey: marketplaceKeys.exposure(id as number),
    queryFn: () => marketplaceProvidersApi.getExposureRules(id as number),
    enabled: id != null,
  });
}

export function useSetProviderExposureRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, effect, reason, organizationId }: {
      id: number;
      effect: ExposureEffect;
      reason: string;
      organizationId?: number | null;
    }) => marketplaceProvidersApi.setExposureRule(id, effect, reason, organizationId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.exposure(variables.id) });
    },
  });
}

export function useRemoveProviderExposureRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ruleId }: { id: number; ruleId: number }) =>
      marketplaceProvidersApi.removeExposureRule(id, ruleId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.exposure(variables.id) });
    },
  });
}

export function useUpdateProviderEngagement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, engagementMode, organizationId }: {
      id: number;
      engagementMode: EngagementMode;
      organizationId?: number | null;
    }) => marketplaceProvidersApi.updateEngagement(id, engagementMode, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.all });
    },
  });
}
