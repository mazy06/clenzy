package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Payload de creation d'une Property cote Channex.
 *
 * <p>Format accepte : {@code { "property": { title, currency, country, timezone, ... } }}
 * (alternative documentee au JSON:API strict pour POST /api/v1/properties).</p>
 *
 * <p>Champs requis par Channex : title, currency, country, timezone.
 * Le {@code group_id} est OPTIONNEL : il faut omettre le champ (pas envoyer
 * une chaine vide) si la property n'appartient a aucun groupe — sinon
 * Channex renvoie 400 "group_id property is invalid".</p>
 */
public record ChannexCreatePropertyRequest(
    String title,
    String currency,
    String country,
    String timezone,
    @JsonProperty("group_id") String groupId
) {

    /** Construit le payload attendu par Channex (omet les champs optionnels vides). */
    public Map<String, Object> toApiPayload() {
        Map<String, Object> property = new LinkedHashMap<>();
        property.put("title", title);
        property.put("currency", currency);
        property.put("country", country);
        property.put("timezone", timezone);
        if (groupId != null && !groupId.isBlank()) {
            property.put("group_id", groupId);
        }
        return Map.of("property", property);
    }
}
