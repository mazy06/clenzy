package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.LinkedHashMap;
import java.util.List;
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
 *     "title":      "BookingCom - Marrakech",  // libelle libre
 *     "channel":    "BookingCom",              // nom Channex du channel (PAS un code court)
 *     "properties": ["uuid"],                  // property Channex cible — TABLEAU
 *     "group_id":   "uuid",                    // group de la property (cf. fetchPropertyGroupId)
 *     "settings":   {"hotel_id": "10485037"},  // specifique au channel, souvent obligatoire
 *     "is_active":  false                      // false : sera active apres l'auth OAuth/credentials
 *   }
 * }
 * </pre>
 *
 * <p><b>{@code properties}, pas {@code property_id}.</b> Le champ singulier est
 * accepte sans erreur mais <b>silencieusement ignore</b> : le channel se cree
 * avec {@code properties: []}, donc rattache a aucune propriete. L'ecran de
 * mapping du wizard n'a alors rien a proposer a droite (« No data ») et le
 * channel ne peut pas etre active. Verifie le 2026-08-14 par POST puis PUT :
 * seul le tableau lie effectivement la propriete.</p>
 *
 * <p><b>{@code settings} n'est pas optionnel en pratique.</b> Sur un channel a
 * credentials comme Booking.com, un POST sans {@code settings.hotel_id} fait
 * repondre Channex <b>500</b> (pas une erreur de validation — leur serveur
 * casse). Avec le hotel_id, la creation passe. Les valeurs attendues dependent
 * du channel : ce DTO ne les interprete pas, il les transmet.</p>
 *
 * <p><b>Noms Channex officiels</b> a utiliser pour le champ {@code channel} :
 * "Airbnb", "BookingCom", "VrboCom", "ExpediaQuickConnect", "Agoda". (Les codes
 * 3 lettres ABB/BDC/VRB/EXP/AGO servent uniquement au filtre {@code available_channels}
 * de l'iframe, pas a la creation API.) Attention : tous ne sont pas creables par
 * API — "Airbnb", "VrboCom" et "ExpediaQuickConnect" repondent
 * {@code channel: is invalid}, leur channel ne se cree que depuis le wizard.
 * L'appelant doit prevoir ce repli.</p>
 */
public record ChannexCreateChannelRequest(
    String title,
    @JsonProperty("channel") String channelName,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("group_id") String groupId,
    @JsonProperty("settings") Map<String, Object> settings
) {
    /** Sans reglages specifiques au channel (OTA purement OAuth). */
    public ChannexCreateChannelRequest(String title, String channelName,
                                       String propertyId, String groupId) {
        this(title, channelName, propertyId, groupId, null);
    }

    /** Construit le payload final attendu par Channex (wrapper "channel" + flags). */
    public Map<String, Object> toApiPayload() {
        Map<String, Object> channel = new LinkedHashMap<>();
        channel.put("title", title);
        channel.put("channel", channelName);
        // Tableau : le singulier property_id est ignore par Channex (cf. Javadoc).
        channel.put("properties", propertyId != null ? List.of(propertyId) : List.of());
        channel.put("group_id", groupId);
        if (settings != null && !settings.isEmpty()) {
            channel.put("settings", settings);
        }
        // L'auth OAuth/credentials chez l'OTA activera le channel apres coup.
        channel.put("is_active", false);
        return Map.of("channel", channel);
    }
}
