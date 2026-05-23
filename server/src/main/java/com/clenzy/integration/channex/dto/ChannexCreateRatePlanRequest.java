package com.clenzy.integration.channex.dto;

import java.util.Map;

/**
 * Payload de creation d'un Rate Plan Channex (sous-resource d'une Property +
 * lie a un Room Type).
 *
 * <p>{@code sell_mode = "per_room"} est le defaut pour la location STR (vs
 * "per_person" pour les hotels qui facturent par personne).</p>
 */
public record ChannexCreateRatePlanRequest(
    String propertyId,
    String roomTypeId,
    String title,
    String currency,
    String sellMode
) {
    public Map<String, Object> toApiPayload() {
        return Map.of(
            "rate_plan", Map.of(
                "property_id", propertyId,
                "room_type_id", roomTypeId,
                "title", title,
                "currency", currency,
                "sell_mode", sellMode
            )
        );
    }

    /** Rate plan standard pour STR : per_room, currency de la property. */
    public static ChannexCreateRatePlanRequest standard(String propertyId, String roomTypeId,
                                                          String currency) {
        return new ChannexCreateRatePlanRequest(propertyId, roomTypeId, "Standard Rate", currency, "per_room");
    }
}
