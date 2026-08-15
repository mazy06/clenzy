package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Objects;

/**
 * Reponse de {@code GET /bookings?property_id=...&dates...}.
 *
 * <p>Channex suit la convention JSON:API : chaque element de {@code data} est
 * une <b>enveloppe</b> {@code {id, type, attributes: {...}}}, les champs du
 * booking vivant dans {@code attributes}. Deserialiser {@code data} directement
 * en {@link ChannexBookingDto} laissait donc {@code propertyId} nul et l'import
 * echouait en « ChannexBookingDto manque id ou propertyId » (constate au
 * 2026-08-14 sur la propriete de certification). C'est le meme deballage que
 * fait deja {@code ChannexBookingFeedService} sur le feed de revisions.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexBookingsListResponse(
    List<Item> data
) {
    /** Enveloppe JSON:API d'un booking. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(String id, ChannexBookingDto attributes) {}

    /** Construit une reponse a partir de bookings deja deballes (tests). */
    public static ChannexBookingsListResponse of(List<ChannexBookingDto> bookings) {
        return new ChannexBookingsListResponse(
            bookings.stream().map(b -> new Item(b.id(), b)).toList());
    }

    public List<ChannexBookingDto> bookings() {
        if (data == null) {
            return List.of();
        }
        return data.stream()
            .map(Item::attributes)
            .filter(Objects::nonNull)
            .toList();
    }
}
