package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Payload de creation d'une Property cote Channex.
 *
 * <p>Channex impose le format JSON:API : un wrapper {@code data: { type, attributes }}.
 * On modelise ca avec une Map pour rester simple, le client appliquera la
 * structure attendue.</p>
 *
 * <p>Champs minimaux requis par l'API Channex (cf. docs.channex.io) :
 * title, currency, country, timezone, address.</p>
 */
public record ChannexCreatePropertyRequest(
    String title,
    String currency,
    String country,
    String timezone,
    @JsonProperty("group_id") String groupId
) {

    /** Construit le payload JSON:API attendu par Channex. */
    public Map<String, Object> toApiPayload() {
        return Map.of(
            "property", Map.of(
                "title", title,
                "currency", currency,
                "country", country,
                "timezone", timezone,
                "group_id", groupId != null ? groupId : ""
            )
        );
    }
}
