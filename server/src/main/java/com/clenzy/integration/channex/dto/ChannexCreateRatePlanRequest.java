package com.clenzy.integration.channex.dto;

import java.util.List;
import java.util.Map;

/**
 * Payload de creation d'un Rate Plan Channex (sous-resource d'une Property +
 * lie a un Room Type).
 *
 * <p>{@code sell_mode = "per_room"} est le defaut pour la location STR (vs
 * "per_person" pour les hotels qui facturent par personne).</p>
 *
 * <p>{@code options} est OBLIGATOIRE chez Channex : la liste des variations de
 * prix par nombre d'occupants. Pour la STR (per_room), on envoie une seule
 * option correspondant a la capacite max du room_type, marquee comme primaire.</p>
 */
public record ChannexCreateRatePlanRequest(
    String propertyId,
    String roomTypeId,
    String title,
    String currency,
    String sellMode,
    int maxOccupancy
) {
    public Map<String, Object> toApiPayload() {
        return Map.of(
            "rate_plan", Map.of(
                "property_id", propertyId,
                "room_type_id", roomTypeId,
                "title", title,
                "currency", currency,
                "sell_mode", sellMode,
                "options", List.of(
                    Map.of(
                        "occupancy", maxOccupancy,
                        "is_primary", true
                    )
                )
            )
        );
    }

    /** Rate plan standard pour STR : per_room, currency de la property. */
    public static ChannexCreateRatePlanRequest standard(String propertyId, String roomTypeId,
                                                          String currency, int maxOccupancy) {
        return new ChannexCreateRatePlanRequest(propertyId, roomTypeId, "Standard Rate",
            currency, "per_room", maxOccupancy);
    }
}
