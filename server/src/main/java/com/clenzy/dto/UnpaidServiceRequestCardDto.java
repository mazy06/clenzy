package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Carte déterministe « demande de service impayée » de la constellation du Superviseur
 * (module Finance). Une carte par {@code ServiceRequest} non réglée du logement.
 *
 * <p>Calculée côté serveur (pas de scan LLM). Le bouton « Régler » réutilise le flux
 * de paiement existant de la demande de service
 * ({@code POST /service-requests/{serviceRequestId}/create-payment-session}).</p>
 *
 * @param id               id stable (dédup front) : {@code service-request-<serviceRequestId>}
 * @param serviceRequestId id de la demande de service à régler
 * @param title            titre (ex. « Ménage Airbnb »)
 * @param motif            montant à régler
 * @param reasoning        explication « pourquoi ? »
 * @param amount           montant dû (estimatedCost)
 */
public record UnpaidServiceRequestCardDto(
        String id,
        Long serviceRequestId,
        String title,
        String motif,
        String reasoning,
        BigDecimal amount
) {
}
