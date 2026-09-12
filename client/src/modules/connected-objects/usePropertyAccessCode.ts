import { useQuery } from '@tanstack/react-query';
import { airbnbApi, type CheckInInstructions } from '../../services/api/airbnbApi';

/**
 * Code d'accès STATIQUE d'un logement (digicode / boîte à clés).
 *
 * <p>À ne pas confondre avec le code d'une serrure connectée
 * ({@code useLockAccessCodeHistory}) : celui-ci vit sur les instructions d'arrivée du
 * LOGEMENT, pas sur l'objet. Il est régénéré après chaque départ
 * (`AccessCodeRotationScheduler` / `RevokeAccessCodeExecutor`), et c'est celui
 * que la notification « Nouveau code d'accès » demande de reporter sur la
 * boîte.</p>
 *
 * <p>La clé est portée par le LOGEMENT, pas par l'objet : plusieurs serrures du
 * même logement partagent donc une seule requête.</p>
 */
export function usePropertyAccessCode(propertyId: number | null) {
  return useQuery({
    queryKey: ['check-in-instructions', propertyId],
    queryFn: (): Promise<CheckInInstructions> => airbnbApi.getCheckInInstructions(propertyId!),
    enabled: propertyId != null,
    staleTime: 60_000,
    // Un logement sans instructions d'arrivée n'est pas une anomalie : on
    // n'affiche simplement pas la ligne.
    retry: false,
  });
}
