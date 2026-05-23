package com.clenzy.integration.channex.dto;

import java.time.LocalDate;

/**
 * Update de disponibilite pour une date donnee sur un room_type Channex.
 *
 * <p>Channex attend une suite de mises a jour atomiques (1 par date).
 * On groupe les updates par batch dans le client.</p>
 *
 * @param channexPropertyId  Property ID cote Channex
 * @param channexRoomTypeId  Room type ID cote Channex
 * @param date               Date concernee
 * @param availability       Nombre d'unites disponibles (0 = bloque)
 */
public record ChannexAvailabilityUpdate(
    String channexPropertyId,
    String channexRoomTypeId,
    LocalDate date,
    int availability
) {
    public ChannexAvailabilityUpdate {
        if (availability < 0) {
            throw new IllegalArgumentException("availability must be >= 0, got " + availability);
        }
    }
}
