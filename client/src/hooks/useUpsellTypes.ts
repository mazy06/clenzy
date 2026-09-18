import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { upsellApi, type UpsellTypeDto } from '../services/api/upsellApi';

/**
 * Référentiel des types de vente additionnelle.
 *
 * <p>Remplace la liste de neuf valeurs codée en dur dans l'écran. Le référentiel
 * vit en base : il embarque les neuf types historiques ET les prestations du
 * catalogue place de marché vendables au voyageur, et une organisation peut y
 * ajouter les siens.</p>
 *
 * <p>Durée de fraîcheur longue : un référentiel ne bouge qu'à l'ajout d'un type,
 * et l'écran des offres le relit à chaque montage.</p>
 */
export const upsellTypeKeys = {
  all: ['upsell-types'] as const,
};

export function useUpsellTypes() {
  return useQuery<UpsellTypeDto[]>({
    queryKey: upsellTypeKeys.all,
    queryFn: () => upsellApi.listTypes(),
    staleTime: 10 * 60_000,
  });
}

export function useCreateUpsellType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { code?: string; label: string; description?: string; iconKey?: string }) =>
      upsellApi.createType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: upsellTypeKeys.all });
    },
  });
}

/**
 * Retire un type du choix.
 *
 * <p>Désactivation et non suppression : les offres déjà créées portent ce code,
 * et un livret diffusé continue de le servir.</p>
 */
export function useDeactivateUpsellType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => upsellApi.deactivateType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: upsellTypeKeys.all });
    },
  });
}
