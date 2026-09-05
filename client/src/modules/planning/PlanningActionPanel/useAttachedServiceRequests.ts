import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { serviceRequestsApi } from '../../../services/api';
import type { ServiceRequest } from '../../../services/api';
import type { PlanningEvent } from '../types';
import {
  filterAttachedToReservation,
  type AttachmentCandidate,
} from '../utils/interventionAttachment';

interface AttachedServiceRequestsParams {
  reservationId?: number;
  /**
   * Événements du planning : ils portent les demandes de service que la brique
   * absorbe. On prend la liste d'AVANT le filtrage par légende — le panneau dit
   * la vérité du séjour, pas ce que la légende laisse voir.
   */
  allEvents?: PlanningEvent[];
  /** Réservations chargées — arbitrage du rattachement. */
  loadedReservations?: AttachmentCandidate[];
}

/**
 * Les demandes de service d'une réservation, selon la MÊME règle de
 * rattachement que la brique du planning et que les interventions.
 *
 * Le serveur ne sait répondre qu'au lien explicite (`reservationId`), qu'il
 * laisse volontairement nul pour une prestation hors séjour. La brique, elle,
 * rattache aussi par les dates : une demande en attente de paiement pouvait
 * donc s'afficher en pastille sans exister dans le panneau. On complète donc la
 * liste du serveur par ce que la règle commune rattache, en rechargeant la
 * fiche COMPLÈTE de ces demandes — la forme allégée du planning ne porte ni
 * l'assignation détaillée ni le devis que le panneau affiche.
 */
export function useAttachedServiceRequests({
  reservationId,
  allEvents,
  loadedReservations = [],
}: AttachedServiceRequestsParams): ServiceRequest[] {
  const { data: linkedRaw, isPending: linkedPending } = useQuery({
    queryKey: ['planning', 'service-requests', reservationId],
    queryFn: async () =>
      (await serviceRequestsApi.getAll({ reservationId })) as ServiceRequest[],
    enabled: !!reservationId,
    staleTime: 30_000,
  });

  const extraIds = useMemo(() => {
    // Tant que la liste du serveur n'a pas répondu, on ne sait pas ce qu'elle
    // porte déjà : compléter maintenant rechargerait une demande qu'elle est en
    // train de rendre. On attend qu'elle ait tranché (succès OU échec).
    if (!reservationId || linkedPending) return [];
    const known = new Set((linkedRaw ?? []).map((sr) => sr.id));
    const candidates = (allEvents ?? [])
      .map((event) => event.serviceRequest)
      .filter((sr) => !!sr && !known.has(sr.id))
      .map((sr) => ({
        id: sr!.id,
        propertyId: sr!.propertyId,
        startDate: sr!.startDate,
        linkedReservationId: sr!.reservationId,
      }));
    return filterAttachedToReservation(candidates, reservationId, loadedReservations).map(
      (sr) => sr.id,
    );
  }, [linkedRaw, linkedPending, allEvents, reservationId, loadedReservations]);

  const extraQueries = useQueries({
    queries: extraIds.map((id) => ({
      queryKey: ['service-request', id],
      queryFn: () => serviceRequestsApi.getById(id),
      staleTime: 30_000,
    })),
  });

  // `useQueries` rend un nouveau tableau à chaque rendu : on mémoïse sur la
  // signature des fiches chargées, sinon la liste changerait d'identité sans
  // avoir changé de contenu.
  const extraSignature = extraQueries.map((q) => q.data?.id ?? 0).join(',');

  return useMemo(() => {
    const merged: ServiceRequest[] = [...(linkedRaw ?? [])];
    for (const query of extraQueries) {
      if (query.data) merged.push(query.data);
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedRaw, extraSignature]);
}
