package com.clenzy.booking.dto;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO leger pour la liste des proprietes dans le Booking Engine public.
 * Pas d'info sensible (owner, adresse exacte, notes internes).
 */
public record PublicPropertyDto(
    Long id,
    String name,
    String type,
    String city,
    String country,
    Integer bedroomCount,
    Integer bathroomCount,
    Integer maxGuests,
    Integer squareMeters,
    BigDecimal priceFrom,
    BigDecimal cleaningFee,
    Integer minimumNights,
    String currency,
    String mainPhotoUrl,
    List<String> photoUrls,
    List<String> amenities,
    String checkInTime,
    String checkOutTime
) {
    public static PublicPropertyDto from(Property p) {
        // Main photo = premiere par date de creation
        String mainPhoto = p.getPhotos() != null
            ? p.getPhotos().stream()
                .map(PropertyPhoto::getUrl)
                .findFirst()
                .orElse(null)
            : null;

        // Amenities stockees en JSON array ou CSV
        List<String> amenityList = null;
        if (p.getAmenities() != null && !p.getAmenities().isBlank()) {
            String raw = p.getAmenities().trim();
            if (raw.startsWith("[")) {
                // JSON array — parse simple
                raw = raw.substring(1, raw.length() - 1);
                amenityList = List.of(raw.replace("\"", "").split(","))
                    .stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
            } else {
                amenityList = List.of(raw.split(","))
                    .stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
            }
        }

        // All photo URLs
        List<String> allPhotoUrls = p.getPhotos() != null
            ? p.getPhotos().stream().map(PropertyPhoto::getUrl).toList()
            : List.of();

        return new PublicPropertyDto(
            p.getId(),
            p.getName(),
            p.getType() != null ? p.getType().name() : null,
            p.getCity(),
            p.getCountry(),
            p.getBedroomCount(),
            p.getBathroomCount(),
            p.getMaxGuests(),
            p.getSquareMeters(),
            p.getNightlyPrice(),
            p.getCleaningBasePrice(),
            p.getMinimumNights(),
            p.getDefaultCurrency(),
            mainPhoto,
            allPhotoUrls,
            amenityList,
            p.getDefaultCheckInTime(),
            p.getDefaultCheckOutTime()
        );
    }
}
