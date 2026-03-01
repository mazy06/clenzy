package com.clenzy.integration.expedia.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO pour les mises a jour de disponibilite et tarifs vers/depuis l'API Expedia.
 *
 * @param propertyId            identifiant de la propriete cote Expedia
 * @param roomTypeId            identifiant du type de chambre
 * @param date                  date concernee
 * @param totalInventoryAvailable nombre d'unites disponibles
 * @param ratePlanId            identifiant du rate plan
 * @param pricePerNight         prix par nuit
 * @param currency              devise (EUR, USD, etc.)
 * @param minLOS                duree de sejour minimum
 * @param maxLOS                duree de sejour maximum
 * @param closedToArrival       ferme a l'arrivee (pas de check-in possible ce jour)
 * @param closedToDeparture     ferme au depart (pas de check-out possible ce jour)
 */
public record ExpediaAvailabilityDto(
        String propertyId,
        String roomTypeId,
        LocalDate date,
        int totalInventoryAvailable,
        String ratePlanId,
        BigDecimal pricePerNight,
        String currency,
        int minLOS,
        int maxLOS,
        boolean closedToArrival,
        boolean closedToDeparture
) {

    /**
     * Indique si la date est disponible a la vente.
     */
    public boolean isAvailable() {
        return totalInventoryAvailable > 0 && !closedToArrival;
    }
}
