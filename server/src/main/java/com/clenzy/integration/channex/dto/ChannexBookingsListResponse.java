package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * Reponse de {@code GET /bookings?property_id=...&dates...}.
 *
 * <p>Channex enveloppe la liste dans un champ {@code data} suivant la convention
 * JSON:API. On extrait juste cette liste pour simplifier l'usage.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexBookingsListResponse(
    List<ChannexBookingDto> data
) {
    public List<ChannexBookingDto> bookings() {
        return data != null ? data : List.of();
    }
}
