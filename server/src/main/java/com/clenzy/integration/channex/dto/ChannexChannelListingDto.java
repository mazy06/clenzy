package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Listing OTA expose sous un channel Channex.
 *
 * <p><b>Endpoint whitelabel</b> : {@code GET /channels/{id}/listings}. Pas
 * accessible en public.</p>
 *
 * <p>Permet enfin de recuperer le NOM TEXTUEL d'une listing Airbnb sans
 * scraper la page publique. Aussi : description, photos, equipement detaille
 * si Channex les expose.</p>
 *
 * @param id            ID interne Channex de la listing
 * @param listingId     ID OTA (ex Airbnb "1512384244344462850")
 * @param title         nom textuel de la listing OTA (ex "Prestige Duplex...")
 * @param description   description complete cote OTA
 * @param mappedRoomId  room_type Channex auquel cette listing est mappee
 * @param mappedRatePlanId rate_plan Channex auquel cette listing est mappee
 * @param channel       code OTA ("AirBNB", "BookingCom", ...)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexChannelListingDto(
    String id,
    @JsonProperty("listing_id") String listingId,
    String title,
    String description,
    @JsonProperty("room_id") String mappedRoomId,
    @JsonProperty("rate_plan_id") String mappedRatePlanId,
    String channel
) {}
