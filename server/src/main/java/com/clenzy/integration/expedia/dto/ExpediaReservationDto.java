package com.clenzy.integration.expedia.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representing an Expedia/VRBO reservation received from the Expedia Rapid API or webhook.
 *
 * @param reservationId    identifiant unique de la reservation cote Expedia
 * @param propertyId       identifiant de la propriete cote Expedia
 * @param roomId           identifiant de la chambre/unite
 * @param guestFirstName   prenom du guest
 * @param guestLastName    nom du guest
 * @param guestEmail       email du guest
 * @param checkIn          date d'arrivee
 * @param checkOut         date de depart
 * @param status           statut (CONFIRMED, CANCELLED, MODIFIED, NO_SHOW)
 * @param totalAmount      montant total de la reservation
 * @param currency         devise (EUR, USD, etc.)
 * @param numberOfAdults   nombre d'adultes
 * @param numberOfChildren nombre d'enfants
 * @param specialRequests  demandes speciales du guest
 * @param source           source de la reservation (VRBO, EXPEDIA, HOTELS_COM)
 */
public record ExpediaReservationDto(
        String reservationId,
        String propertyId,
        String roomId,
        String guestFirstName,
        String guestLastName,
        String guestEmail,
        LocalDate checkIn,
        LocalDate checkOut,
        String status,
        BigDecimal totalAmount,
        String currency,
        int numberOfAdults,
        int numberOfChildren,
        String specialRequests,
        String source
) {

    /**
     * Nom complet du guest.
     */
    public String guestFullName() {
        if (guestFirstName == null && guestLastName == null) {
            return null;
        }
        return ((guestFirstName != null ? guestFirstName : "")
                + " "
                + (guestLastName != null ? guestLastName : "")).trim();
    }

    /**
     * Nombre total de guests.
     */
    public int totalGuests() {
        return numberOfAdults + numberOfChildren;
    }
}
