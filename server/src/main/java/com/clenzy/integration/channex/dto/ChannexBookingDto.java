package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Booking recue depuis un OTA via Channex.
 *
 * <p>Channex normalise les bookings de tous les OTAs dans un format commun :
 * c'est l'avantage du middleware vs des integrations directes (chaque OTA
 * a son propre schema).</p>
 *
 * <p>Ne contient que les champs critiques pour la creation d'une Reservation
 * Clenzy. Le reste (notes, taxes detaillees, currency conversion) est ignore
 * via {@link JsonIgnoreProperties}.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexBookingDto(
    String id,
    @JsonProperty("ota_reservation_code") String otaReservationCode,
    @JsonProperty("ota_name") String otaName,
    @JsonProperty("property_id") String propertyId,
    @JsonProperty("status") String status,  // "new" | "modified" | "cancelled"
    @JsonProperty("arrival_date") LocalDate arrivalDate,
    @JsonProperty("departure_date") LocalDate departureDate,
    @JsonProperty("amount") BigDecimal amount,
    @JsonProperty("currency") String currency,
    @JsonProperty("customer") ChannexCustomer customer,
    @JsonProperty("rooms") List<ChannexBookingRoom> rooms
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChannexCustomer(
        @JsonProperty("name") String name,
        @JsonProperty("surname") String surname,
        @JsonProperty("mail") String email,
        @JsonProperty("phone") String phone,
        @JsonProperty("country") String country,
        @JsonProperty("language") String language
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChannexBookingRoom(
        @JsonProperty("room_type_id") String roomTypeId,
        @JsonProperty("rate_plan_id") String ratePlanId,
        @JsonProperty("occupancy") ChannexOccupancy occupancy
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChannexOccupancy(
        @JsonProperty("adults") Integer adults,
        @JsonProperty("children") Integer children,
        @JsonProperty("infants") Integer infants
    ) {}

    /** Convenance : total des occupants. */
    public int totalGuests() {
        if (rooms == null || rooms.isEmpty() || rooms.get(0).occupancy() == null) return 1;
        ChannexOccupancy o = rooms.get(0).occupancy();
        return (o.adults() != null ? o.adults() : 1)
            + (o.children() != null ? o.children() : 0)
            + (o.infants() != null ? o.infants() : 0);
    }

    private ChannexOccupancy firstOccupancy() {
        if (rooms == null || rooms.isEmpty()) return null;
        return rooms.get(0).occupancy();
    }

    /** Ventilation adultes (taxables) — null si l'occupation n'est pas fournie. */
    public Integer adults() {
        ChannexOccupancy o = firstOccupancy();
        return o != null ? o.adults() : null;
    }

    /** Ventilation enfants + nourrissons (exoneres) — null si occupation absente. */
    public Integer taxableChildren() {
        ChannexOccupancy o = firstOccupancy();
        if (o == null) return null;
        return (o.children() != null ? o.children() : 0)
            + (o.infants() != null ? o.infants() : 0);
    }
}
