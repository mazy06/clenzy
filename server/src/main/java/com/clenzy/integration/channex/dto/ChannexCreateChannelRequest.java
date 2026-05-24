package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Payload de creation d'un Channel cote Channex.
 *
 * <p>Format API confirme empiriquement (la doc officielle dit "whitelabel only"
 * mais l'endpoint marche aussi avec une cle API standard) :</p>
 *
 * <pre>
 * POST /api/v1/channels
 * {
 *   "channel": {
 *     "title":       "Airbnb - Marrakech",   // libelle libre
 *     "channel":     "Airbnb",                // nom Channex du channel (PAS un code court)
 *     "property_id": "uuid",                  // property Channex cible
 *     "group_id":    "uuid",                  // group de la property (cf. fetchPropertyGroupId)
 *     "is_active":   false                    // false : sera active apres l'auth OAuth/credentials
 *   }
 * }
 * </pre>
 *
 * <p><b>Noms Channex officiels</b> a utiliser pour le champ {@code channel} :
 * "Airbnb", "BookingCom", "VrboCom", "ExpediaQuickConnect", "Agoda". (Les codes
 * 3 lettres ABB/BDC/VRB/EXP/AGO servent uniquement au filtre {@code available_channels}
 * de l'iframe, pas a la creation API.)</p>
 */
public record ChannexCreateChannelRequest(
    String title,
    @JsonProperty("channel") String channelName,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("group_id") String groupId
) {
    /** Construit le payload final attendu par Channex (wrapper "channel" + flags). */
    public Map<String, Object> toApiPayload() {
        Map<String, Object> channel = new LinkedHashMap<>();
        channel.put("title", title);
        channel.put("channel", channelName);
        channel.put("property_id", propertyId);
        channel.put("group_id", groupId);
        // L'auth OAuth/credentials chez l'OTA activera le channel apres coup.
        channel.put("is_active", false);
        return Map.of("channel", channel);
    }
}
