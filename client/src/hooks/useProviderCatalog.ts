import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { providerCatalogApi } from '../services/api/providerCatalogApi';
import type { CatalogSearchParams } from '../services/api/providerCatalogApi';

export const catalogKeys = {
  all: ['provider-catalog'] as const,
  list: (params: CatalogSearchParams) => [...catalogKeys.all, 'list', params] as const,
  detail: (id: number) => [...catalogKeys.all, 'detail', id] as const,
  categories: () => [...catalogKeys.all, 'categories'] as const,
};

/**
 * Une page du catalogue.
 *
 * Conserver les données du même compte : changer de filtre ne doit pas vider la grille le temps
 * de l'aller-retour — le vide se lit comme « aucun résultat », pas comme
 * « chargement ».
 */
export function useProviderCatalog(params: CatalogSearchParams) {
  const { user, loading } = useAuth();
  const scope = JSON.stringify([user?.id, user?.organizationId]);
  return useQuery({
    queryKey: [...catalogKeys.list(params), scope],
    queryFn: () => providerCatalogApi.search(params),
    enabled: !!user && !loading,
    placeholderData: (previous, query) => query?.queryKey.at(-1) === scope ? previous : undefined,
  });
}

export function useCatalogProvider(id: number | undefined) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...catalogKeys.detail(id as number), user?.id, user?.organizationId],
    queryFn: () => providerCatalogApi.getById(id as number),
    enabled: id != null && !!user && !loading,
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: () => providerCatalogApi.getCategories(),
    staleTime: 10 * 60 * 1000,
  });
}
