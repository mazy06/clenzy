package com.clenzy.dto;

import java.time.LocalDate;

/**
 * Carte de rappel « un reversement sera généré demain » affichée dans la
 * constellation du Superviseur (module Finance). Purement informative :
 * elle ne déclenche ni ne valide aucun virement (l'approbation reste dans
 * Facturation &gt; Reversements).
 *
 * @param id         identifiant stable de l'échéance (dédup côté front)
 * @param title      titre de la carte
 * @param motif      motif court (échéance)
 * @param reasoning  explication « pourquoi ? » en langage métier
 * @param payoutDate date de génération prévue du lot (demain)
 */
public record PayoutReminderDto(
        String id,
        String title,
        String motif,
        String reasoning,
        LocalDate payoutDate
) {
}
