package com.clenzy.dto;

import java.util.List;
import java.util.Map;

/**
 * Les quatre jeux de donnees que le planning peint sur une meme fenetre.
 *
 * <p>Ils vivaient derriere quatre endpoints distincts, appeles avec les MEMES
 * logements et la MEME plage de dates : le client en emettait donc quatre par
 * tranche de dates, soit douze pour peindre une fenetre. Un seul appel les
 * couvre, sans changer ni le contenu ni la maniere dont chacun est filtre.</p>
 *
 * @param reservations    sejours, deja filtres selon ce que le porteur peut voir
 * @param interventions   menages / maintenances ; <b>vide</b> si le porteur n'a
 *                        pas le role requis — voir PlanningDataController
 * @param awaitingPayment demandes de service en attente de paiement
 * @param blocked         jours BLOCKED / MAINTENANCE (indisponibilites hors sejour)
 */
public record PlanningDataDto(
    List<ReservationDto> reservations,
    List<Map<String, Object>> interventions,
    List<Map<String, Object>> awaitingPayment,
    List<Map<String, Object>> blocked
) {}
