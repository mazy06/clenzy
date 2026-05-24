package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Hotel policies Channex (un par property typiquement).
 *
 * <p>Expose via {@code GET /hotel_policies?filter[property_id]=...}. Contient
 * les regles operationnelles : horaires, animaux, fumeurs, max guests.</p>
 *
 * @param checkinTime         heure d'arrivee (ex "15:00")
 * @param checkoutTime        heure de depart (ex "11:00")
 * @param petsPolicy          "ALLOWED" | "NOT_ALLOWED" | "ON_REQUEST" (string variant)
 * @param smokingPolicy       idem
 * @param isAdultsOnly        true si reserve aux adultes
 * @param maxCountOfGuests    capacite max DIFFERENTE de la property/room_type
 *                            (souvent egal mais possible override)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexHotelPolicyDto(
    String id,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("checkin_time") String checkinTime,
    @JsonProperty("checkout_time") String checkoutTime,
    @JsonProperty("pets_policy") String petsPolicy,
    @JsonProperty("smoking_policy") String smokingPolicy,
    @JsonProperty("is_adults_only") Boolean isAdultsOnly,
    @JsonProperty("max_count_of_guests") Integer maxCountOfGuests
) {}
