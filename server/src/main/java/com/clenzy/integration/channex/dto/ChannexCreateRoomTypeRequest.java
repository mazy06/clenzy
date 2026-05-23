package com.clenzy.integration.channex.dto;

import java.util.Map;

/**
 * Payload de creation d'un Room Type Channex (sous-resource d'une Property).
 *
 * <p>Champs minimaux requis :</p>
 * <ul>
 *   <li>{@code title} — nom court visible cote OTAs (ex: "Studio Standard")</li>
 *   <li>{@code count} — nombre d'unites identiques disponibles (typiquement 1 pour STR)</li>
 *   <li>{@code occ_adults} — capacite adultes max</li>
 *   <li>{@code occ_children} — capacite enfants (0 par defaut)</li>
 *   <li>{@code occ_infants} — capacite bebes (0 par defaut)</li>
 * </ul>
 */
public record ChannexCreateRoomTypeRequest(
    String propertyId,
    String title,
    int count,
    int occAdults,
    int occChildren,
    int occInfants
) {
    public Map<String, Object> toApiPayload() {
        return Map.of(
            "room_type", Map.of(
                "property_id", propertyId,
                "title", title,
                "count", count,
                "occ_adults", occAdults,
                "occ_children", occChildren,
                "occ_infants", occInfants
            )
        );
    }

    /** Variante simple : juste titre + capacite adultes (defaut 0 enfants/bebes). */
    public static ChannexCreateRoomTypeRequest simple(String propertyId, String title, int maxAdults) {
        return new ChannexCreateRoomTypeRequest(propertyId, title, 1, maxAdults, 0, 0);
    }
}
