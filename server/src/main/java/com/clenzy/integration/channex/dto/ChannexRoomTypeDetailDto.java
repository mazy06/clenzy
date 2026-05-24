package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Detail complet d'un room_type Channex (extension du DTO basique
 * {@link ChannexRoomTypeDto}).
 *
 * <p>Exposable via {@code GET /room_types/{id}}. Contient les capacites
 * detaillees, le contenu (description + photos lies au room) et la liste
 * des facilities (souvent vide chez non-whitelabel, mais on les passe quand meme).</p>
 *
 * @param countOfRooms      nombre de chambres (mapping → Property.bedroomCount)
 * @param occAdults         capacite adultes
 * @param occChildren       capacite enfants
 * @param occInfants        capacite bebes
 * @param defaultOccupancy  occupation par defaut (utilise comme max_guests si occ* absents)
 * @param capacity          lits de type dortoir (si applicable)
 * @param roomKind          "room" | "apartment" | etc.
 * @param content           sub-object content (description + photos)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexRoomTypeDetailDto(
    String id,
    String title,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("count_of_rooms") Integer countOfRooms,
    @JsonProperty("occ_adults") Integer occAdults,
    @JsonProperty("occ_children") Integer occChildren,
    @JsonProperty("occ_infants") Integer occInfants,
    @JsonProperty("default_occupancy") Integer defaultOccupancy,
    Integer capacity,
    @JsonProperty("room_kind") String roomKind,
    JsonNode content
) {

    /**
     * Calcule le max_guests effectif a partir des champs occ_*.
     * <p>Priorite : occ_adults + occ_children + occ_infants si presents,
     * sinon default_occupancy, sinon null.</p>
     */
    public Integer resolveMaxGuests() {
        if (occAdults != null) {
            int sum = occAdults;
            if (occChildren != null) sum += occChildren;
            if (occInfants != null) sum += occInfants;
            return sum;
        }
        return defaultOccupancy;
    }
}
